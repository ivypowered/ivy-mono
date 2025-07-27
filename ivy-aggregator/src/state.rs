use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use std::io;
use std::path::Path;
use std::sync::RwLock;
use std::time::SystemTime;
use ureq::config::Config;
use ureq::Agent;

use crate::chart::Candle;
use crate::charts::{ChartKind, Charts};
use crate::event::{
    CommentEvent, Event, EventData, GameBurnEvent, GameCreateEvent, GameDepositEvent,
    GameEditEvent, GameSwapEvent, GameWithdrawEvent, WorldCreateEvent, WorldSwapEvent,
    WorldUpdateEvent, WorldVestingEvent,
};
use crate::game::Game;
use crate::jsonl::{JsonReader, JsonWriter};
use crate::public::Public;
use crate::quote::Quote;
use crate::signature::Signature;
use crate::sqrt_curve::SqrtCurve;
use crate::util::{
    from_game_amount, from_ivy_amount, from_usdc_amount, to_ivy_amount, to_usdc_amount,
};
use crate::vendor::constant_product::ConstantProductCurve;
use crate::volume::Volume;

// ==================
// === Constants ===
// ==================

/// The maximum number of candles in a chart; beyond this, they are dropped, oldest first.
const MAX_CANDLES: usize = 4096;
/// The maximum length of the game hot list in memory.
const MAX_HOT_GAMES: usize = 1024;
/// The maximum age (in seconds) that games are allowed to have before they're removed from the hot list.
const MAX_HOT_GAME_AGE: u64 = 86400;
/// The minimum number of games that should be in the hot list; this overrides MAX_HOT_GAME_AGE
const MIN_HOT_GAME_COUNT: usize = 50;
/// Number of update cycles between each hot game list refresh.
const HOT_GAME_LIST_REFRESH_INTERVAL: u64 = 10;
/// The maximum number of games featured on the about page.
const MAX_FEATURED_GAMES: usize = 5;

// =======================
// === Helper Functions ===
// =======================

/// Convert a float USD value into a `u64` tenths of a cent (mils)
fn usd_to_mil(v: f32) -> u64 {
    if !v.is_normal() {
        return 0;
    }
    (v * 1000.0) as u64
}

/// Convert tenths of a cent into a float USD value
fn mil_to_usd(v: u64) -> f32 {
    (v as f32) / 1000.0
}

/// Normalize a string for searching: trim, lowercase, ASCII only, no spaces.
fn normalize_string(s: &str) -> String {
    s.trim()
        .chars()
        .filter(|c| c.is_ascii())
        .filter(|c| !c.is_whitespace())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

/// Calculate the hot score of a game based on market cap and age.
fn calculate_hot_score(ivy_mkt_cap: u64, age_seconds: u64) -> f32 {
    let mkt_cap = from_ivy_amount(ivy_mkt_cap);
    let age_in_hours = (age_seconds as f32) / 3600.0;
    // Score formula: market_cap / (age_in_hours + 2)^1.8
    mkt_cap / (age_in_hours + 2.0).powf(1.8)
}

/// Create a sorted list of hot game indices based on their hot score.
fn create_hot_game_list(recent_games: &[Game]) -> Vec<usize> {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let mut scored_indices: Vec<(f32, usize)> = Vec::new();

    // Process games from newest to oldest, calculating score
    for (index, game) in recent_games.iter().enumerate().rev() {
        let age_seconds = now.saturating_sub(game.create_timestamp);

        // Stop if games are older than the max allowed age for the hot list
        // - and we have enough games to fulfill our preferred minimum
        if age_seconds > MAX_HOT_GAME_AGE && scored_indices.len() > MIN_HOT_GAME_COUNT {
            break;
        }

        let hot_score = calculate_hot_score(game.ivy_balance, age_seconds);
        scored_indices.push((hot_score, index));
    }

    // Sort indices by their corresponding hot scores (descending)
    scored_indices.sort_by(|a, b| b.0.total_cmp(&a.0));

    // Extract indices, limit list size, and reclaim memory
    let mut game_indices: Vec<usize> = scored_indices.into_iter().map(|(_, index)| index).collect();
    if game_indices.len() > MAX_HOT_GAMES {
        game_indices.truncate(MAX_HOT_GAMES);
        game_indices.shrink_to_fit();
    }

    game_indices
}

// ==========================
// === Core Data Structs ===
// ==========================

/// Data for a game's comments
#[derive(Clone, Serialize)]
pub struct CommentInfo {
    total: usize,
    comment_buf_index: u64,
    comments: Vec<Comment>,
}

/// Identifier for completed burns.
#[derive(Hash, Clone, Copy, PartialEq, Eq)]
struct Burn {
    game: Public,
    id: [u8; 32],
}

/// Identifier for completed deposits.
#[derive(Hash, Clone, Copy, PartialEq, Eq)]
struct Deposit {
    game: Public,
    id: [u8; 32],
}

/// Identifier for claimed withdraws.
#[derive(Hash, Clone, Copy, PartialEq, Eq)]
struct Withdraw {
    game: Public,
    id: [u8; 32],
}

/// Entry for sorting games by IVY balance in the `top_games` set.
#[derive(Hash, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct TopGameEntry {
    ivy_balance: u64, // IVY balance (higher is better)
    index: usize,     // Game index in `game_list`
}

/// A comment on a game
#[derive(Clone, Serialize)]
pub struct Comment {
    index: u64,
    user: Public,
    timestamp: u64,
    text: String,
}

/// Metadata associated with each game, including charts and NFTs.
struct GameMeta {
    index: usize,   // Index in the main `game_list` vector
    charts: Charts, // GAME/USDC charts
    comments: Vec<Comment>,
}

/// Data related to the global IVY/USDC market.
#[derive(Clone, Copy)]
struct WorldData {
    // From swap event
    usdc_balance: u64,
    ivy_sold: u64,
    ivy_vested: u64,
    // From create event
    create_timestamp: u64,
    ivy_curve_max: u64,
    curve_input_scale_num: u32,
    curve_input_scale_den: u32,
    // From update event
    ivy_initial_liquidity: u64,
    game_initial_liquidity: u64,
    ivy_fee_bps: u8,
    game_fee_bps: u8,
}

#[derive(Clone, Copy, Serialize)]
pub struct BurnInfo {
    signature: Signature,
    timestamp: u64,
}

#[derive(Clone, Copy, Serialize)]
pub struct DepositInfo {
    signature: Signature,
    timestamp: u64,
}

#[derive(Clone, Copy, Serialize)]
pub struct WithdrawInfo {
    signature: Signature,
    timestamp: u64,
    withdraw_authority: Public,
}

#[derive(Clone, Serialize)]
pub struct ChartResponse {
    candles: Vec<Candle>,
    mkt_cap_usd: f32,
    change_24h: f32,
}

#[derive(Clone, Copy, Serialize)]
pub struct IvyInfo {
    create_timestamp: u64,
    ivy_initial_liquidity: f32,
    game_initial_liquidity: f32,
    ivy_price: f32,
    ivy_mkt_cap: f32,
    ivy_change_24h: f32,
}

#[derive(Clone, Serialize)]
pub struct GlobalGame {
    title: String,
    symbol: String,
    price: f32,
    market_cap: f32,
    cover_image: String,
    address: Public,
}

#[derive(Clone, Serialize)]
pub struct GlobalInfo {
    games_listed: u64,
    tvl: f32,
    volume_24h: f32,
    featured_games: Vec<GlobalGame>,
}

// ======================================
// === Internal State Representation ===
// ======================================

/// Holds the primary application state, managed internally.
struct StateData {
    // Game data
    address_to_game_meta: HashMap<Public, GameMeta>, // game_address -> GameMeta
    game_list: Vec<Game>,                            // Chronological list of all games
    top_games: BTreeSet<TopGameEntry>,               // Games sorted by market cap (desc)
    hot_game_cache: Vec<usize>,                      // Indices of hot games (cached)
    t_since_hot_refresh: u64,                        // Counter for hot game refresh interval
    game_tvl: u64, // Sum of IVY deposited into all games (excluding initial)

    // World (IVY/USDC) data
    world_data: WorldData,
    ivy_charts: Charts, // IVY/USDC price charts
    ivy_price: f32,     // Current IVY price in USDC

    // Other state
    burns: HashMap<Burn, BurnInfo>, // Map of completed burns to info
    withdraws: HashMap<Withdraw, WithdrawInfo>, // Map of completed withdraws to info
    deposits: HashMap<Deposit, DepositInfo>, // Map of completed deposits to info
    evt_writer: JsonWriter<Event>,  // For persisting events
    last_signature: Option<Signature>, // Signature of the last processed event
    api_url: String,                // For fetching new events
    volume_24h: Volume,             // Keeps track of volume
}

impl StateData {
    /// Update the `top_games` sorted set when a game's market cap changes.
    fn update_top_games(&mut self, index: usize, old_ivy_balance: Option<u64>, ivy_balance: u64) {
        // Remove the old entry if it existed
        if let Some(old) = old_ivy_balance {
            self.top_games.remove(&TopGameEntry {
                ivy_balance: old,
                index,
            });
        }
        // Insert the new entry
        self.top_games.insert(TopGameEntry { ivy_balance, index });
    }

    /// Update the total IVY TVL across all games.
    fn update_game_tvl(
        &mut self,
        old_ivy_balance: u64,
        ivy_balance: u64,
        starting_ivy_balance: u64,
    ) {
        // Subtract the contribution of the old IVY balance (above starting value)
        self.game_tvl = self
            .game_tvl
            .saturating_sub(old_ivy_balance.saturating_sub(starting_ivy_balance));
        // Add the contribution of the new IVY balance (above starting value)
        self.game_tvl = self
            .game_tvl
            .saturating_add(ivy_balance.saturating_sub(starting_ivy_balance));
    }

    // --- Event Processing Methods ---

    fn process_game_create(&mut self, timestamp: u64, create_data: GameCreateEvent) {
        if self.address_to_game_meta.contains_key(&create_data.game) {
            eprintln!(
                "warning: Corrupted state? Received multiple GameCreateEvent for game {}",
                create_data.game
            );
            return;
        }

        let game_balance = from_game_amount(create_data.game_balance);
        let game_price_usd =
            (from_ivy_amount(create_data.ivy_balance) / game_balance) * self.ivy_price;
        let normalized_name = normalize_string(&create_data.name);
        let game = Game {
            name: create_data.name,
            symbol: create_data.symbol,
            mint: create_data.mint,
            address: create_data.game,
            swap_alt: create_data.swap_alt,
            owner: Public::zero(),
            withdraw_authority: Public::zero(),
            game_url: String::new(),     // Updated later via GameUpdate
            cover_url: String::new(),    // Updated later via GameUpdate
            metadata_url: String::new(), // Updated later via GameUpdate
            create_timestamp: timestamp,
            ivy_balance: create_data.ivy_balance,
            game_balance: create_data.game_balance,
            starting_ivy_balance: create_data.ivy_balance, // Store initial balance
            comment_buf_index: 0,
            normalized_name,
            last_price_usd: game_price_usd,
            mkt_cap_usd: game_balance * game_price_usd,
            change_pct_24h: 0.0,
        };

        let index = self.game_list.len();
        self.game_list.push(game);

        // initialize charts with current price as first candle
        let mut charts = Charts::new(MAX_CANDLES);
        _ = charts.append(timestamp, game_price_usd, 0.0);

        self.address_to_game_meta.insert(
            create_data.game,
            GameMeta {
                index,
                charts,
                comments: Vec::new(),
            },
        );

        // Add to top games list
        self.update_top_games(index, None, create_data.ivy_balance);
        self.update_game_tvl(0, create_data.ivy_balance, create_data.ivy_balance);
    }

    fn process_game_edit(&mut self, edit_data: GameEditEvent) {
        let game_meta = match self.address_to_game_meta.get(&edit_data.game) {
            Some(meta) => meta,
            None => {
                eprintln!(
                    "warning: Received GameEditEvent for nonexistent game {}",
                    edit_data.game
                );
                return;
            }
        };

        let game = &mut self.game_list[game_meta.index];
        game.owner = edit_data.owner;
        game.withdraw_authority = edit_data.withdraw_authority;
        game.game_url = edit_data.game_url;
        game.cover_url = edit_data.cover_url;
        game.metadata_url = edit_data.metadata_url;
    }

    fn process_game_swap(
        &mut self,
        timestamp: u64,
        signature: Signature,
        swap_data: GameSwapEvent,
    ) {
        // Calculate trade value in USDC and check against minimum threshold
        let ivy_amount = from_ivy_amount(swap_data.ivy_amount);
        let usdc_value = ivy_amount * self.ivy_price;

        // Get game_meta and update game information in one go
        let game_meta = match self.address_to_game_meta.get_mut(&swap_data.game) {
            Some(meta) => meta,
            None => {
                eprintln!(
                    "warning: Received GameSwapEvent for nonexistent game {}",
                    swap_data.game
                );
                return;
            }
        };

        // Cache the game index for use later
        let game_index = game_meta.index;

        // Update the game state
        let game = &mut self.game_list[game_index];
        game.game_balance = swap_data.game_balance;
        let new_ivy_balance = swap_data.ivy_balance;
        let old_ivy_balance = std::mem::replace(&mut game.ivy_balance, new_ivy_balance);
        let starting_ivy_balance = game.starting_ivy_balance;

        // Calculate GAME price for charting
        let game_price_ivy =
            from_ivy_amount(swap_data.ivy_balance) / from_game_amount(swap_data.game_balance);
        let game_price_usd = game_price_ivy * self.ivy_price;
        if !game_price_usd.is_normal() {
            eprintln!(
                "warning: Invalid price calculation (game: {}, sig: {}, price_ivy: {})",
                swap_data.game, signature, game_price_ivy
            );
            return; // Ignore invalid price calculations
        }
        game.last_price_usd = game_price_usd;

        // Handle charts for this game
        if let Err(e) = game_meta
            .charts
            .append(timestamp, game_price_usd, usdc_value)
        {
            eprintln!(
                "warning: Could not append to game chart (game: {}, sig: {}, time: {}): {}",
                swap_data.game, signature, timestamp, e
            );
        }

        game.mkt_cap_usd = from_ivy_amount(game.ivy_balance) * self.ivy_price;
        game.change_pct_24h = game_meta.charts.get_change_pct_24h().unwrap_or(0.0);

        // Update global state based on the market cap change
        self.update_top_games(game_index, Some(old_ivy_balance), new_ivy_balance);
        self.update_game_tvl(old_ivy_balance, new_ivy_balance, starting_ivy_balance);

        // Add volume to global volume array
        self.volume_24h.append(usd_to_mil(usdc_value), timestamp);
    }

    fn process_game_burn(
        &mut self,
        timestamp: u64,
        signature: Signature,
        burn_data: GameBurnEvent,
    ) {
        self.burns
            .entry(Burn {
                game: burn_data.game,
                id: burn_data.id,
            })
            .or_insert(BurnInfo {
                signature,
                timestamp,
            });
    }

    fn process_game_deposit(
        &mut self,
        timestamp: u64,
        signature: Signature,
        deposit_data: GameDepositEvent,
    ) {
        self.deposits
            .entry(Deposit {
                game: deposit_data.game,
                id: deposit_data.id,
            })
            .or_insert(DepositInfo {
                signature,
                timestamp,
            });
    }

    fn process_game_withdraw(
        &mut self,
        timestamp: u64,
        signature: Signature,
        withdraw_data: GameWithdrawEvent,
    ) {
        self.withdraws
            .entry(Withdraw {
                game: withdraw_data.game,
                id: withdraw_data.id,
            })
            .or_insert(WithdrawInfo {
                signature,
                timestamp,
                withdraw_authority: withdraw_data.withdraw_authority,
            });
    }

    fn process_world_create(&mut self, timestamp: u64, create_data: WorldCreateEvent) {
        self.world_data.create_timestamp = timestamp;
        self.world_data.ivy_curve_max = create_data.ivy_curve_max;
        self.world_data.curve_input_scale_num = create_data.curve_input_scale_num;
        self.world_data.curve_input_scale_den = create_data.curve_input_scale_den;
    }

    fn process_world_update(&mut self, update_data: WorldUpdateEvent) {
        self.world_data.ivy_initial_liquidity = update_data.ivy_initial_liquidity;
        self.world_data.game_initial_liquidity = update_data.game_initial_liquidity;
        self.world_data.ivy_fee_bps = update_data.ivy_fee_bps;
        self.world_data.game_fee_bps = update_data.game_fee_bps;
    }

    fn process_world_swap(
        &mut self,
        timestamp: u64,
        signature: Signature,
        swap_data: WorldSwapEvent,
    ) {
        // Calculate trade value and check minimum threshold
        let usdc_amount = from_usdc_amount(swap_data.usdc_amount);

        // Calculate IVY price in USDC
        let ivy_price = SqrtCurve::current_price(
            from_ivy_amount(swap_data.ivy_sold) as f64,
            (self.world_data.curve_input_scale_num as f64)
                / (self.world_data.curve_input_scale_den as f64),
        ) as f32;
        if !ivy_price.is_normal() {
            return; // Ignore invalid price calculations
        }

        // Update world state
        self.ivy_price = ivy_price;
        self.world_data.usdc_balance = swap_data.usdc_balance;
        self.world_data.ivy_sold = swap_data.ivy_sold;

        // Append data point to the IVY/USDC chart
        if let Err(e) = self
            .ivy_charts
            .append(timestamp, self.ivy_price, usdc_amount)
        {
            eprintln!(
                "warning: Could not append to IVY chart (sig: {}, time: {}): {}",
                signature, timestamp, e
            );
        }
    }

    fn process_world_vesting(&mut self, vesting_data: WorldVestingEvent) {
        self.world_data.ivy_vested = vesting_data.ivy_vested;
    }

    fn process_comment_event(&mut self, comment_data: CommentEvent) {
        let game_meta = match self.address_to_game_meta.get_mut(&comment_data.game) {
            Some(meta) => meta,
            None => {
                eprintln!(
                    "warning: Received CommentEvent for nonexistent game {}",
                    comment_data.game
                );
                return;
            }
        };
        game_meta.comments.push(Comment {
            index: comment_data.comment_index,
            user: comment_data.user,
            timestamp: comment_data.timestamp,
            text: comment_data.text,
        });
        self.game_list[game_meta.index].comment_buf_index = comment_data.buf_index;
    }

    fn process_unknown(&mut self, name: &str) {
        eprintln!("warning: Received unknown event type '{}'", name);
    }

    /// Process a single event, updating the state accordingly. Must be called chronologically.
    fn process_event(&mut self, event: Event) {
        // Extract event common data before moving event.data
        let timestamp = event.timestamp;
        let signature = event.signature.clone();

        // Dispatch based on event data type
        match event.data {
            EventData::GameCreate(data) => self.process_game_create(timestamp, data),
            EventData::GameEdit(data) => self.process_game_edit(data),
            EventData::GameSwap(data) => self.process_game_swap(timestamp, signature, data),
            EventData::GameBurn(data) => self.process_game_burn(timestamp, signature, data),
            EventData::GameDeposit(data) => self.process_game_deposit(timestamp, signature, data),
            EventData::GameWithdraw(data) => self.process_game_withdraw(timestamp, signature, data),
            EventData::WorldCreate(data) => self.process_world_create(timestamp, data),
            EventData::WorldUpdate(data) => self.process_world_update(data),
            EventData::WorldSwap(data) => self.process_world_swap(timestamp, signature, data),
            EventData::WorldVesting(data) => self.process_world_vesting(data),
            EventData::CommentEvent(data) => self.process_comment_event(data),
            EventData::VaultDepositEvent(_) => {} // nothing 4 now
            EventData::VaultWithdrawEvent(_) => {} // nothing 4 now
            EventData::Unknown(name) => self.process_unknown(&name),
        }
        // Always update the last seen signature
        self.last_signature = Some(signature);
    }
}

// ==================
// === Public API ===
// ==================

/// The thread-safe, publicly accessible state container.
pub struct State {
    data: RwLock<StateData>,
}

impl State {
    /// Create a new `State` instance, loading historical events from the given path.
    pub fn new(api_url: &str, path: &str) -> Result<State, io::Error> {
        // Ensure the directory for the event log exists
        if let Some(parent) = Path::new(path).parent() {
            std::fs::create_dir_all(parent)?;
        }

        let evt_writer = JsonWriter::new(path)?;

        // Initialize empty state data
        let mut state_data = StateData {
            address_to_game_meta: HashMap::new(),
            top_games: BTreeSet::new(),
            hot_game_cache: Vec::new(),
            game_list: Vec::new(),
            evt_writer,
            last_signature: None,
            ivy_charts: Charts::new(MAX_CANDLES),
            burns: HashMap::new(),
            deposits: HashMap::new(),
            withdraws: HashMap::new(),
            ivy_price: 0.0, // Will be updated by first WorldSwap event
            world_data: WorldData {
                usdc_balance: 0,
                ivy_sold: 0,
                ivy_vested: 0,
                create_timestamp: 0,
                ivy_curve_max: 1, // Avoid division by zero before WorldCreate
                curve_input_scale_num: 1, // Avoid division by zero before WorldCreate
                curve_input_scale_den: 1, // Avoid division by zero before WorldCreate
                ivy_initial_liquidity: 0,
                game_initial_liquidity: 0,
                ivy_fee_bps: 0,
                game_fee_bps: 0,
            },
            game_tvl: 0,
            // Initialize counter to force immediate refresh on first update
            t_since_hot_refresh: HOT_GAME_LIST_REFRESH_INTERVAL,
            api_url: api_url.to_string(),
            volume_24h: Volume::new(60 * 24),
        };

        // Replay historical events from the log file
        let mut evt_reader = JsonReader::new(path)?;
        while let Some(event) = evt_reader.read()? {
            state_data.process_event(event);
        }

        // If historical events exist, calculate the initial hot game list
        if !state_data.game_list.is_empty() {
            state_data.hot_game_cache = create_hot_game_list(&state_data.game_list);
            state_data.t_since_hot_refresh = 0; // Reset counter after initial calculation
        }

        Ok(State {
            data: RwLock::new(state_data),
        })
    }

    /// Fetch new events from the API, persist them, and update the state.
    /// Also handles periodic refreshing of the hot game list cache.
    pub fn update(&self) -> Result<(), Box<dyn std::error::Error>> {
        #[derive(Serialize)]
        struct GetEventsParams {
            after: Option<Signature>,
        }

        #[derive(Deserialize)]
        #[serde(tag = "status")]
        enum GetEventsResponse {
            #[serde(rename = "ok")]
            Ok { data: Vec<Event> },
            #[serde(rename = "err")]
            Err { msg: String },
        }

        // Prepare API request parameters (read lock needed for last_signature)
        let (params, api_url) = {
            let data = self.data.read().unwrap();
            (
                GetEventsParams {
                    after: data.last_signature,
                },
                data.api_url.clone(),
            )
        };

        // Build URL with query parameters
        let mut url = format!("{}/events", api_url);
        if let Some(signature) = &params.after {
            url = format!("{}?after={}", url, signature);
        }

        // Fetch new events using GET instead of POST
        let agent = Agent::new_with_config(Config::builder().http_status_as_error(false).build());
        let response: GetEventsResponse = agent
            .get(&url)
            .call()
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?
            .body_mut()
            .read_json()?;

        let events = match response {
            GetEventsResponse::Ok { data } => data,
            GetEventsResponse::Err { msg } => return Err(format!("API error: {}", msg).into()),
        };

        // Process events (maybe), and update hot game refresh counter
        let needs_hot_refresh = {
            let mut data = self.data.write().unwrap();
            if !events.is_empty() {
                // Persist events first
                data.evt_writer.write_multiple(&events)?;

                // Process events chronologically
                for event in events {
                    data.process_event(event);
                }
            }
            data.t_since_hot_refresh += 1;
            data.t_since_hot_refresh >= HOT_GAME_LIST_REFRESH_INTERVAL
        };

        // Refresh hot games list if needed
        if needs_hot_refresh {
            // Create hot game list
            let hot_game_cache = create_hot_game_list(&self.data.read().unwrap().game_list);

            // Write the new cache and reset the counter
            let mut data = self.data.write().unwrap();
            data.hot_game_cache = hot_game_cache;
            data.t_since_hot_refresh = 0; // Reset counter
        }

        Ok(())
    }

    // --- Query Methods ---

    /// Get burn info for a specified game and burn ID, or None if it does not exist
    pub fn get_burn_info(&self, game: Public, id: [u8; 32]) -> Option<BurnInfo> {
        let data = self.data.read().unwrap();
        data.burns.get(&Burn { game, id }).map(|p| *p)
    }

    /// Get deposit info for a specified game and deposit ID, or None if it does not exist
    pub fn get_deposit_info(&self, game: Public, id: [u8; 32]) -> Option<DepositInfo> {
        let data = self.data.read().unwrap();
        data.deposits.get(&Deposit { game, id }).map(|p| *p)
    }

    /// Get withdraw info for a specified game and deposit ID, or None if it does not exist
    pub fn get_withdraw_info(&self, game: Public, id: [u8; 32]) -> Option<WithdrawInfo> {
        let data = self.data.read().unwrap();
        data.withdraws.get(&Withdraw { game, id }).map(|p| *p)
    }

    /// Get a game by its address.
    pub fn get_game_by_address(&self, address: &Public) -> Option<Game> {
        let data = self.data.read().unwrap();
        data.address_to_game_meta
            .get(address)
            .map(|meta| data.game_list[meta.index].clone())
    }

    /// Get the total number of games.
    pub fn get_game_count(&self) -> usize {
        let data = self.data.read().unwrap();
        data.game_list.len()
    }

    /// Get the most recent games, newest first.
    pub fn get_recent_games(&self, count: usize, skip: usize) -> Vec<Game> {
        let data = self.data.read().unwrap();
        data.game_list
            .iter()
            .rev()
            .skip(skip)
            .take(count)
            .cloned()
            .collect()
    }

    /// Get games sorted by highest market cap, descending.
    pub fn get_top_games(&self, count: usize, skip: usize) -> Vec<Game> {
        let data = self.data.read().unwrap();
        data.top_games
            .iter()
            .rev() // BTreeSet iterates lowest->highest, so reverse for highest->lowest
            .skip(skip)
            .take(count)
            .map(|entry| data.game_list[entry.index].clone())
            .collect()
    }

    /// Get games sorted by the 'hot' score, descending. Uses a cached list.
    pub fn get_hot_games(&self, count: usize, skip: usize) -> Vec<Game> {
        let data = self.data.read().unwrap();
        data.hot_game_cache
            .iter()
            .skip(skip)
            .take(count)
            .map(|&game_index| data.game_list[game_index].clone())
            .collect()
    }

    /// Search recent games by normalized name.
    pub fn search_recent_games_by_name(
        &self,
        name: String,
        count: usize,
        skip: usize,
    ) -> Vec<Game> {
        let data = self.data.read().unwrap();
        let query = normalize_string(&name);
        if query.is_empty() {
            return Vec::new();
        }

        data.game_list
            .iter()
            .rev() // Search newest first
            .filter(|game| game.normalized_name.contains(&query))
            .skip(skip)
            .take(count)
            .cloned()
            .collect()
    }

    /// Search top games (by market cap) by normalized name.
    pub fn search_top_games_by_name(&self, name: String, count: usize, skip: usize) -> Vec<Game> {
        let data = self.data.read().unwrap();
        let query = normalize_string(&name);
        if query.is_empty() {
            return Vec::new();
        }

        data.top_games
            .iter()
            .rev() // Search highest market cap first
            .filter_map(|entry| {
                let game = &data.game_list[entry.index];
                if game.normalized_name.contains(&query) {
                    Some(game.clone())
                } else {
                    None
                }
            })
            .skip(skip)
            .take(count)
            .collect()
    }

    /// Query candle data + market cap info for a game.
    pub fn query_game_chart(
        &self,
        game: Public,
        kind: ChartKind,
        count: usize,
        until_inclusive: u64,
    ) -> ChartResponse {
        let data = self.data.read().unwrap();
        match data.address_to_game_meta.get(&game) {
            Some(game_meta) => ChartResponse {
                candles: game_meta.charts.query(kind, count, until_inclusive),
                mkt_cap_usd: data.game_list[game_meta.index].mkt_cap_usd,
                change_24h: data.game_list[game_meta.index].change_pct_24h,
            },
            None => ChartResponse {
                candles: Vec::new(),
                mkt_cap_usd: 0.0,
                change_24h: 0.0,
            },
        }
    }

    /// Query candle data for the global IVY/USDC price chart.
    pub fn query_ivy_chart(
        &self,
        kind: ChartKind,
        count: usize,
        until_inclusive: u64,
    ) -> ChartResponse {
        let data = self.data.read().unwrap();
        ChartResponse {
            candles: data.ivy_charts.query(kind, count, until_inclusive),
            mkt_cap_usd: from_ivy_amount(data.world_data.ivy_sold) * data.ivy_price,
            change_24h: data.ivy_charts.get_change_pct_24h().unwrap_or(0.0),
        }
    }

    /// Get the current estimated IVY price in USDC.
    pub fn get_ivy_price(&self) -> f32 {
        let data = self.data.read().unwrap();
        data.ivy_price
    }

    /// Estimate the output amount of an ExactIn swap between IVY and a game token
    /// using the constant product curve logic, **including fees**.
    pub fn get_game_quote(
        &self,
        game_address: Public,
        input_amount: u64,
        is_buy: bool,
    ) -> Result<Quote, &'static str> {
        if input_amount == 0 {
            return Ok(Quote::zero());
        }

        // Read necessary data
        let (ivy_balance, game_balance, ivy_price, world_game_fee_bps, world_ivy_fee_bps) = {
            let data = self.data.read().unwrap();
            let game_meta = data
                .address_to_game_meta
                .get(&game_address)
                .ok_or("Game not found")?;
            let game = &data.game_list[game_meta.index];
            (
                game.ivy_balance,
                game.game_balance,
                data.ivy_price,
                data.world_data.game_fee_bps as u64,
                data.world_data.ivy_fee_bps as u64,
            )
        };

        // Setup reserves and fee rates based on swap direction
        let (input_reserve, output_reserve, input_fee_bps, output_fee_bps) = if is_buy {
            (
                ivy_balance,
                game_balance,
                world_ivy_fee_bps,
                world_game_fee_bps,
            )
        } else {
            (
                game_balance,
                ivy_balance,
                world_game_fee_bps,
                world_ivy_fee_bps,
            )
        };

        // Check if there's liquidity for the swap
        if ivy_balance == 0 || game_balance == 0 {
            return Ok(Quote::zero());
        }

        // Calculate initial price for price impact calculation
        let initial_price = from_ivy_amount(ivy_balance) / from_game_amount(game_balance);

        // Apply input fee - use u128 for fee calculation to prevent overflow
        let input_fee_amount = ((input_amount as u128 * input_fee_bps as u128) / 10_000) as u64;
        let amount_to_curve = input_amount.saturating_sub(input_fee_amount);
        if amount_to_curve == 0 {
            return Ok(Quote::zero());
        }

        // Calculate output from curve
        let amount_from_curve: u64 = ConstantProductCurve::swap_base_input_without_fees(
            amount_to_curve as u128,
            input_reserve as u128,
            output_reserve as u128,
        )
        .ok_or("Arithmetic error during swap estimation")?
        .try_into()
        .map_err(|_| "Final output amount exceeds u64 maximum")?;

        // Apply output fee - use u128 for fee calculation to prevent overflow
        let output_fee_amount =
            ((amount_from_curve as u128 * output_fee_bps as u128) / 10_000) as u64;
        let final_output_amount = amount_from_curve.saturating_sub(output_fee_amount);

        // Calculate new balances for price impact
        let (new_ivy, new_game) = if is_buy {
            (
                ivy_balance.saturating_add(amount_to_curve),
                game_balance.saturating_sub(amount_from_curve),
            )
        } else {
            (
                ivy_balance.saturating_sub(amount_from_curve),
                game_balance.saturating_add(amount_to_curve),
            )
        };

        // Calculate new price and price impact
        let new_price = if new_ivy > 0 && new_game > 0 {
            from_ivy_amount(new_ivy) / from_game_amount(new_game)
        } else {
            initial_price
        };

        let price_impact_bps = if initial_price > 0.0 {
            let impact = ((new_price - initial_price).abs() / initial_price) * 10_000.0;
            (impact.min(10_000.0)) as u16
        } else {
            0
        };

        // Get current game price
        let game_price = initial_price * ivy_price;

        let (input_amount_usd, output_amount_usd) = if is_buy {
            let input_usd = from_ivy_amount(input_amount) * ivy_price;
            let output_usd = from_game_amount(final_output_amount) * game_price;
            (input_usd, output_usd)
        } else {
            let input_usd = from_game_amount(input_amount) * game_price;
            let output_usd = from_ivy_amount(final_output_amount) * ivy_price;
            (input_usd, output_usd)
        };

        Ok(Quote {
            output_amount: final_output_amount,
            input_amount_usd,
            output_amount_usd,
            price_impact_bps,
        })
    }

    /// Query the comments
    pub fn query_comments(
        &self,
        game: Public,
        count: usize,
        skip: usize,
        reverse: bool,
    ) -> CommentInfo {
        let data = self.data.read().unwrap();
        let game_meta = match data.address_to_game_meta.get(&game) {
            Some(v) => v,
            None => {
                return CommentInfo {
                    total: 0,
                    comment_buf_index: 0,
                    comments: Vec::new(),
                }
            }
        };
        let comments = if reverse {
            game_meta
                .comments
                .iter()
                .rev()
                .skip(skip)
                .take(count)
                .cloned()
                .collect()
        } else {
            game_meta
                .comments
                .iter()
                .skip(skip)
                .take(count)
                .cloned()
                .collect()
        };
        return CommentInfo {
            total: game_meta.comments.len(),
            comment_buf_index: data.game_list[game_meta.index].comment_buf_index,
            comments,
        };
    }

    /// Estimate the world output amount of an ExactIn swap between USDC and IVY
    /// using the square root curve logic (with no fees).
    pub fn get_world_quote(
        &self,
        input_amount: u64,
        is_buy: bool, // true if swapping USDC for IVY, false if swapping IVY for USDC
    ) -> Result<Quote, &'static str> {
        let world_data = self.data.read().unwrap().world_data;

        let input_scale =
            (world_data.curve_input_scale_num as f64) / (world_data.curve_input_scale_den as f64);
        let ivy_sold = from_ivy_amount(world_data.ivy_sold) as f64;

        let price = SqrtCurve::current_price(ivy_sold, input_scale) as f32;

        let output_amount = if is_buy {
            // Input USDC (reserve), output IVY (tokens)
            let ivy_curve_max = from_ivy_amount(world_data.ivy_curve_max) as f64;
            to_ivy_amount(SqrtCurve::exact_reserve_in(
                ivy_sold,
                ivy_curve_max,
                input_scale,
                from_usdc_amount(input_amount) as f64,
            )?)
        } else {
            // Input IVY (tokens), output USDC (reserve)
            to_usdc_amount(SqrtCurve::exact_tokens_in(
                ivy_sold,
                input_scale,
                from_ivy_amount(input_amount) as f64,
            )?)
        };

        let new_price = SqrtCurve::current_price(
            from_ivy_amount(if is_buy {
                world_data.ivy_sold.saturating_add(output_amount)
            } else {
                world_data.ivy_sold.saturating_sub(input_amount)
            }) as f64,
            input_scale,
        ) as f32;

        let price_impact_bps = (((new_price - price).abs() / price) * 10_000.0) as u16;

        // Calculate USD values
        let input_amount_usd = if is_buy {
            // If buying IVY with USDC, input amount is already in USDC (≈ USD)
            from_usdc_amount(input_amount)
        } else {
            // If selling IVY for USDC, convert IVY amount to USD
            from_ivy_amount(input_amount) * price
        };

        let output_amount_usd = if is_buy {
            // If buying IVY with USDC, convert IVY output to USD
            from_ivy_amount(output_amount) * price
        } else {
            // If selling IVY for USDC, output amount is already in USDC (≈ USD)
            from_usdc_amount(output_amount)
        };

        return Ok(Quote {
            output_amount,
            input_amount_usd,
            output_amount_usd,
            price_impact_bps,
        });
    }

    pub fn get_ivy_info(&self) -> IvyInfo {
        let data = self.data.read().unwrap();
        IvyInfo {
            create_timestamp: data.world_data.create_timestamp,
            ivy_initial_liquidity: from_ivy_amount(
                self.data.read().unwrap().world_data.ivy_initial_liquidity,
            ),
            game_initial_liquidity: from_game_amount(
                self.data.read().unwrap().world_data.game_initial_liquidity,
            ),
            ivy_price: data.ivy_price,
            ivy_change_24h: data.ivy_charts.get_change_pct_24h().unwrap_or(0.0),
            ivy_mkt_cap: from_ivy_amount(data.world_data.ivy_sold) * data.ivy_price,
        }
    }

    pub fn get_global_info(&self) -> GlobalInfo {
        let data = self.data.read().unwrap();
        let featured_games: Vec<GlobalGame> = data
            .top_games
            .iter() // lo->hi
            .rev() // hi->lo
            .take(MAX_FEATURED_GAMES)
            .map(|x| &data.game_list[x.index])
            .map(|g| GlobalGame {
                title: g.name.clone(),
                symbol: g.symbol.clone(),
                price: g.last_price_usd,
                market_cap: g.mkt_cap_usd,
                cover_image: g.cover_url.clone(),
                address: g.address,
            })
            .collect();
        GlobalInfo {
            games_listed: data.game_list.len() as u64,
            tvl: from_ivy_amount(data.game_tvl),
            volume_24h: mil_to_usd(data.volume_24h.get()),
            featured_games,
        }
    }
}
