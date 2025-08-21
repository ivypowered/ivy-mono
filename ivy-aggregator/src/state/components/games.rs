use std::collections::HashMap;

use crate::types::asset::Asset;
use crate::types::chart::Candle;
use crate::types::charts::{ChartKind, Charts};
use crate::types::event::{
    CommentEvent, Event, EventData, GameCreateEvent, GameEditEvent, GameSwapEvent, GameUpgradeEvent,
};
use crate::types::game::Game;
use crate::types::public::Public;
use crate::types::signature::Signature;
use crate::types::trade::Trade;
use crate::util::{from_game_amount, from_ivy_amount};
use serde::Serialize;
use tokio::sync::{broadcast, watch};

use super::assets::AssetsComponent;
use super::world::WorldComponent;
use crate::state::constants::HIDDEN_GAMES;
use crate::state::helpers::normalize_string;
use crate::state::types::Comment;

// 512 updates before receiver is deemed lagged :)
const CHANNEL_BUFFER_SIZE: usize = 512;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct GameBalanceUpdate {
    pub ivy_balance: u64,
    pub game_balance: u64,
    pub mkt_cap_usd: f32,
    pub change_pct_24h: f32,
}

struct GameMeta {
    index: usize,
    charts: Charts,
    comments: Vec<Comment>,
    // Broadcast channels for real-time updates
    balance_update_tx: Option<broadcast::Sender<GameBalanceUpdate>>,
    comment_update_tx: Option<broadcast::Sender<Comment>>,
}

impl GameMeta {
    fn new(index: usize, charts: Charts) -> Self {
        Self {
            index,
            charts,
            comments: Vec::new(),
            balance_update_tx: None,
            comment_update_tx: None,
        }
    }

    /// Subscribe to balance updates for this game
    fn subscribe_to_balances(&mut self) -> broadcast::Receiver<GameBalanceUpdate> {
        match &self.balance_update_tx {
            None => {
                let (tx, rx) = broadcast::channel(CHANNEL_BUFFER_SIZE);
                self.balance_update_tx = Some(tx);
                rx
            }
            Some(tx) => tx.subscribe(),
        }
    }

    /// Subscribe to comment updates for this game
    fn subscribe_to_comments(&mut self) -> broadcast::Receiver<Comment> {
        match &self.comment_update_tx {
            None => {
                let (tx, rx) = broadcast::channel(CHANNEL_BUFFER_SIZE);
                self.comment_update_tx = Some(tx);
                rx
            }
            Some(tx) => tx.subscribe(),
        }
    }

    /// Broadcast a balance update, dropping the channel if there are no receivers
    fn broadcast_balance_update(&mut self, update: GameBalanceUpdate) {
        if let Some(tx) = &self.balance_update_tx {
            if tx.send(update).is_err() {
                // No receivers, drop the channel to save memory
                self.balance_update_tx = None;
            }
        }
    }

    /// Broadcast a new comment, dropping the channel if there are no receivers
    fn broadcast_comment(&mut self, comment: Comment) {
        if let Some(tx) = &self.comment_update_tx {
            if tx.send(comment).is_err() {
                // No receivers, drop the channel to save memory
                self.comment_update_tx = None;
            }
        }
    }
}

pub struct GamesComponent {
    address_to_game_meta: HashMap<Public, GameMeta>,
    pub game_list: Vec<Game>, // Made public for direct access
    game_tvl: u64,
    max_candles: usize,
    trades_tx: watch::Sender<Option<Trade>>,
    assets_tx: broadcast::Sender<Asset>,
}

impl GamesComponent {
    pub fn new(
        max_candles: usize,
        trades_tx: watch::Sender<Option<Trade>>,
        assets_tx: broadcast::Sender<Asset>,
    ) -> Self {
        Self {
            address_to_game_meta: HashMap::new(),
            game_list: Vec::new(),
            game_tvl: 0,
            max_candles,
            trades_tx,
            assets_tx,
        }
    }

    /// Subscribe to real-time balance updates for a specific game.
    /// Returns a receiver that will receive `GameBalanceUpdate` every time the game's balances change.
    pub fn subscribe_to_game_balances(
        &mut self,
        game: &Public,
    ) -> Option<broadcast::Receiver<GameBalanceUpdate>> {
        self.address_to_game_meta
            .get_mut(game)
            .map(|meta| meta.subscribe_to_balances())
    }

    /// Subscribe to real-time comment updates for a specific game.
    /// Returns a receiver that will receive new `Comment` entries as they are posted.
    pub fn subscribe_to_game_comments(
        &mut self,
        game: &Public,
    ) -> Option<broadcast::Receiver<Comment>> {
        self.address_to_game_meta
            .get_mut(game)
            .map(|meta| meta.subscribe_to_comments())
    }

    /// Subscribe to chart updates for a specific game.
    /// Returns a receiver that will receive candle updates for the specified chart kind.
    pub fn subscribe_to_game_chart(
        &mut self,
        game: &Public,
        kind: ChartKind,
    ) -> Option<broadcast::Receiver<Candle>> {
        self.address_to_game_meta
            .get_mut(game)
            .map(|meta| meta.charts.subscribe_to_kind(kind))
    }

    pub fn on_event(
        &mut self,
        event: &Event,
        world: &WorldComponent,
        assets: &mut AssetsComponent,
    ) -> bool {
        match &event.data {
            EventData::GameCreate(data) => {
                self.process_game_create(event.timestamp, data, world, assets)
            }
            EventData::GameEdit(data) => self.process_game_edit(data),
            EventData::GameSwap(data) => {
                self.process_game_swap(event.timestamp, &event.signature, data, world, assets)
            }
            EventData::GameUpgrade(data) => self.process_game_upgrade(data),
            EventData::Comment(data) => self.process_comment_event(data),
            _ => return false,
        };
        true
    }

    fn process_game_create(
        &mut self,
        timestamp: u64,
        create_data: &GameCreateEvent,
        world: &WorldComponent,
        assets: &mut AssetsComponent,
    ) {
        if HIDDEN_GAMES.contains(&create_data.game) {
            return;
        }
        if self.address_to_game_meta.contains_key(&create_data.game) {
            eprintln!(
                "warning: Corrupted state? Received multiple GameCreateEvent for game {}",
                create_data.game
            );
            return;
        }

        let game_balance = from_game_amount(create_data.game_balance);
        let game_price_usd =
            (from_ivy_amount(create_data.ivy_balance) / game_balance) * world.price();

        let normalized_name = normalize_string(&create_data.name);

        let game = Game {
            name: create_data.name.clone(),
            symbol: create_data.symbol.clone(),
            mint: create_data.mint,
            address: create_data.game,
            swap_alt: create_data.swap_alt,
            owner: Public::zero(),
            withdraw_authority: Public::zero(),
            game_url: String::new(),
            icon_url: String::new(),
            short_desc: String::new(),
            metadata_url: String::new(),
            create_timestamp: timestamp,
            ivy_balance: create_data.ivy_balance,
            game_balance: create_data.game_balance,
            starting_ivy_balance: create_data.ivy_balance,
            starting_game_balance: create_data.game_balance,
            normalized_name,
            last_price_usd: game_price_usd,
            mkt_cap_usd: game_balance * game_price_usd,
            change_pct_24h: 0.0,
        };

        let index = self.game_list.len();
        let mkt_cap_usd = game.mkt_cap_usd;
        let create_timestamp = game.create_timestamp;
        self.game_list.push(game);

        let mut charts = Charts::new(self.max_candles);
        charts.append(timestamp, game_price_usd, 0.0).unwrap();

        let mut meta = GameMeta::new(index, charts);

        // Broadcast initial balance update
        meta.broadcast_balance_update(GameBalanceUpdate {
            ivy_balance: create_data.ivy_balance,
            game_balance: create_data.game_balance,
            mkt_cap_usd,
            change_pct_24h: 0.0,
        });

        self.address_to_game_meta.insert(create_data.game, meta);
        self.update_game_tvl(0, create_data.ivy_balance, create_data.ivy_balance);

        // Update assets component
        assets.on_game_created(index, mkt_cap_usd, create_timestamp);
    }

    fn process_game_edit(&mut self, edit_data: &GameEditEvent) {
        if HIDDEN_GAMES.contains(&edit_data.game) {
            return;
        }

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
        if game.icon_url.is_empty()
            && game.game_url.is_empty()
            && game.short_desc.is_empty()
            && game.metadata_url.is_empty()
        {
            // This is a new game, alert frontend
            _ = self.assets_tx.send(Asset {
                name: game.name.clone(),
                symbol: game.symbol.clone(),
                address: game.address,
                icon_url: edit_data.icon_url.clone(),
                short_desc: edit_data.short_desc.clone(),
                create_timestamp: game.create_timestamp,
                mkt_cap_usd: game.mkt_cap_usd,
            });
        }

        // Update with edit data
        game.owner = edit_data.owner;
        game.withdraw_authority = edit_data.withdraw_authority;
        game.icon_url = edit_data.icon_url.clone();
        game.game_url = edit_data.game_url.clone();
        game.short_desc = edit_data.short_desc.clone();
        game.metadata_url = edit_data.metadata_url.clone();
    }

    fn process_game_swap(
        &mut self,
        timestamp: u64,
        signature: &Signature,
        swap_data: &GameSwapEvent,
        world: &WorldComponent,
        assets: &mut AssetsComponent,
    ) {
        if HIDDEN_GAMES.contains(&swap_data.game) {
            return;
        }

        let ivy_amount = from_ivy_amount(swap_data.ivy_amount);
        let usdc_value = ivy_amount * world.price();

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

        let game_index = game_meta.index;
        let game = &mut self.game_list[game_index];
        game.game_balance = swap_data.game_balance;

        let new_ivy_balance = swap_data.ivy_balance;
        let old_ivy_balance = std::mem::replace(&mut game.ivy_balance, new_ivy_balance);
        let starting_ivy_balance = game.starting_ivy_balance;

        let game_price_ivy =
            from_ivy_amount(swap_data.ivy_balance) / from_game_amount(swap_data.game_balance);
        let game_price_usd = game_price_ivy * world.price();
        if !game_price_usd.is_normal() {
            eprintln!(
                "warning: Invalid price calculation (game: {}, sig: {}, price_ivy: {})",
                swap_data.game, signature, game_price_ivy
            );
            return;
        }

        let old_mkt_cap_usd = game.mkt_cap_usd;
        game.last_price_usd = game_price_usd;

        if let Err(e) = game_meta
            .charts
            .append(timestamp, game_price_usd, usdc_value)
        {
            eprintln!(
                "warning: Could not append to game chart (game: {}, sig: {}, time: {}): {}",
                swap_data.game, signature, timestamp, e
            );
        }

        game.mkt_cap_usd = from_game_amount(game.starting_game_balance) * game_price_usd;
        game.change_pct_24h = game_meta.charts.get_change_pct_24h().unwrap_or(0.0);

        // Broadcast balance update
        game_meta.broadcast_balance_update(GameBalanceUpdate {
            ivy_balance: swap_data.ivy_balance,
            game_balance: swap_data.game_balance,
            mkt_cap_usd: game.mkt_cap_usd,
            change_pct_24h: game.change_pct_24h,
        });

        // Send to trades listener
        _ = self.trades_tx.send(Some(Trade {
            user: swap_data.user,
            asset: swap_data.game,
            symbol: game.symbol.clone(),
            icon_url: game.icon_url.clone(),
            volume_usd: usdc_value,
            mkt_cap_usd: game.mkt_cap_usd,
            is_buy: swap_data.is_buy,
        }));

        let mkt_cap_usd = game.mkt_cap_usd;
        let create_timestamp = game.create_timestamp;
        self.update_game_tvl(old_ivy_balance, new_ivy_balance, starting_ivy_balance);

        // Update assets component
        assets.on_game_updated(game_index, old_mkt_cap_usd, mkt_cap_usd, create_timestamp);
    }

    fn process_game_upgrade(&mut self, upgrade_data: &GameUpgradeEvent) {
        if HIDDEN_GAMES.contains(&upgrade_data.game) {
            return;
        }
        if let Some(game_meta) = self.address_to_game_meta.get(&upgrade_data.game) {
            let game = &mut self.game_list[game_meta.index];
            game.short_desc = upgrade_data.short_desc.clone();
            game.icon_url = upgrade_data.icon_url.clone();
        } else {
            eprintln!(
                "warning: Received GameUpgradeEvent for nonexistent game {}",
                upgrade_data.game
            );
        }
    }

    fn process_comment_event(&mut self, comment_data: &CommentEvent) {
        if HIDDEN_GAMES.contains(&comment_data.game) {
            return;
        }

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

        let comment = Comment {
            index: comment_data.comment_index,
            user: comment_data.user,
            timestamp: comment_data.timestamp,
            text: comment_data.text.clone(),
        };

        // Broadcast the new comment
        game_meta.broadcast_comment(comment.clone());

        game_meta.comments.push(comment);
    }

    fn update_game_tvl(
        &mut self,
        old_ivy_balance: u64,
        ivy_balance: u64,
        starting_ivy_balance: u64,
    ) {
        self.game_tvl = self
            .game_tvl
            .saturating_sub(old_ivy_balance.saturating_sub(starting_ivy_balance));
        self.game_tvl = self
            .game_tvl
            .saturating_add(ivy_balance.saturating_sub(starting_ivy_balance));
    }

    // --- Getters used by queries ---

    pub fn get_game_by_address(&self, address: &Public) -> Option<Game> {
        self.address_to_game_meta
            .get(address)
            .map(|meta| self.game_list[meta.index].clone())
    }

    pub fn get_game_count(&self) -> usize {
        self.game_list.len()
    }

    pub fn query_game_chart(
        &self,
        game: Public,
        kind: ChartKind,
        count: usize,
        until_inclusive: u64,
    ) -> (Vec<Candle>, f32, f32) {
        match self.address_to_game_meta.get(&game) {
            Some(m) => {
                let candles = m.charts.query(kind, count, until_inclusive);
                let g = &self.game_list[m.index];
                (candles, g.mkt_cap_usd, g.change_pct_24h)
            }
            None => (Vec::new(), 0.0, 0.0),
        }
    }

    pub fn get_comment_info(
        &self,
        game: Public,
        count: usize,
        skip: usize,
        reverse: bool,
    ) -> (usize, Vec<Comment>) {
        let meta = match self.address_to_game_meta.get(&game) {
            Some(v) => v,
            None => return (0, Vec::new()),
        };
        let comments = if reverse {
            meta.comments
                .iter()
                .rev()
                .skip(skip)
                .take(count)
                .cloned()
                .collect()
        } else {
            meta.comments
                .iter()
                .skip(skip)
                .take(count)
                .cloned()
                .collect()
        };
        let total = meta.comments.len();
        (total, comments)
    }

    pub fn tvl_raw_ivy(&self) -> u64 {
        self.game_tvl
    }

    pub fn last_price_for(&self, game: &Public) -> f32 {
        self.address_to_game_meta
            .get(game)
            .map(|m| self.game_list[m.index].last_price_usd)
            .unwrap_or_default()
    }

    pub fn reserves_for(&self, game_address: &Public) -> Option<(u64, u64)> {
        self.address_to_game_meta.get(game_address).map(|m| {
            let g = &self.game_list[m.index];
            (g.ivy_balance, g.game_balance)
        })
    }
}
