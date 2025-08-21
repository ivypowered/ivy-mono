use std::collections::HashMap;

use serde::Serialize;
use tokio::sync::{broadcast, watch};

use crate::pf::{PaBuyEvent, PaSellEvent, PfMigrationEvent, PfTradeEvent};
use crate::state::components::prices::PricesComponent;
use crate::state::constants::MAX_CANDLES;
use crate::types::asset::Asset;
use crate::types::chart::Candle;
use crate::types::charts::{ChartKind, Charts};
use crate::types::event::{Event, EventData, SyncCreateEvent};
use crate::types::public::Public;
use crate::types::sync::Sync;
use crate::types::trade::Trade;
use crate::util::{from_sol_amount, from_token_amount};

use super::assets::AssetsComponent;

// PF bonding curve parameters
const INITIAL_VIRTUAL_TOKEN_RESERVES: usize = 1_073_000_000_000_000; // 1.073 billion TOKEN
const INITIAL_VIRTUAL_SOL_RESERVES: usize = 30_000_000_000; // 30 SOL

// 512 updates before receiver is deemed lagged :)
const CHANNEL_BUFFER_SIZE: usize = 512;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct SyncUpdate {
    pub sol_reserves: u64, // virtual reserves pre-migration, pool reserves post-migration
    pub token_reserves: u64, // virtual reserves pre-migration, pool reserves post-migration
    pub mkt_cap_usd: f32,
    pub change_pct_24h: f32,
    pub is_migrated: bool,
    pub pswap_pool: Option<Public>,
}

// SYNC supply: 1_000_000 tokens @ 9 decimals (1e6)
// Raw amount = 1e6 * 1e9 = 1e15
const SYNC_MAX_SUPPLY_TOKENS: f32 = 1_000_000.0;

struct SyncMeta {
    charts: Charts,
    // Broadcast channel for real-time updates
    update_tx: Option<broadcast::Sender<SyncUpdate>>,
}

impl SyncMeta {
    fn new() -> Self {
        Self {
            charts: Charts::new(MAX_CANDLES),
            update_tx: None,
        }
    }

    /// Subscribe to sync updates (both curve and pool)
    fn subscribe(&mut self) -> broadcast::Receiver<SyncUpdate> {
        match &self.update_tx {
            None => {
                let (tx, rx) = broadcast::channel(CHANNEL_BUFFER_SIZE);
                self.update_tx = Some(tx);
                rx
            }
            Some(tx) => tx.subscribe(),
        }
    }

    /// Broadcast a sync update, dropping the channel if there are no receivers
    fn broadcast_update(&mut self, update: SyncUpdate) {
        if let Some(tx) = &self.update_tx {
            if tx.send(update).is_err() {
                // No receivers, drop the channel to save memory
                self.update_tx = None;
            }
        }
    }
}

pub struct SyncComponent {
    // primary storage - parallel vectors
    pub syncs: Vec<Sync>,
    metas: Vec<SyncMeta>,

    // indices - all store usize index directly
    address_to_index: HashMap<Public, usize>,
    pump_mint_to_index: HashMap<Public, usize>,
    pool_to_index: HashMap<Public, usize>,

    // Trade stream for frontend updates
    trades_tx: watch::Sender<Option<Trade>>,
    // Asset stream for frontend updates
    assets_tx: broadcast::Sender<Asset>,
}

impl SyncComponent {
    pub fn new(
        trades_tx: watch::Sender<Option<Trade>>,
        assets_tx: broadcast::Sender<Asset>,
    ) -> Self {
        Self {
            syncs: Vec::new(),
            metas: Vec::new(),
            address_to_index: HashMap::new(),
            pump_mint_to_index: HashMap::new(),
            pool_to_index: HashMap::new(),
            trades_tx,
            assets_tx,
        }
    }

    /// Subscribe to sync updates (works for both curve and pool)
    pub fn subscribe_to_sync(&mut self, sync: &Public) -> Option<broadcast::Receiver<SyncUpdate>> {
        self.address_to_index
            .get(sync)
            .map(|&index| self.metas[index].subscribe())
    }

    /// Subscribe to chart updates for a specific sync
    pub fn subscribe_to_sync_chart(
        &mut self,
        sync: &Public,
        kind: ChartKind,
    ) -> Option<broadcast::Receiver<Candle>> {
        self.address_to_index
            .get(sync)
            .map(|&index| self.metas[index].charts.subscribe_to_kind(kind))
    }

    pub fn on_event(
        &mut self,
        event: &Event,
        prices: &PricesComponent,
        assets: &mut AssetsComponent,
    ) -> bool {
        match &event.data {
            EventData::SyncCreate(d) => self.handle_sync_create(event.timestamp, d, prices, assets),
            EventData::PfTrade(d) => self.handle_pf_trade(event.timestamp, d, prices, assets),
            EventData::PfMigration(d) => self.handle_pf_migration(d),
            EventData::PaBuy(d) => self.handle_pa_buy(event.timestamp, d, prices, assets),
            EventData::PaSell(d) => self.handle_pa_sell(event.timestamp, d, prices, assets),
            _ => return false,
        }
        true
    }

    fn handle_sync_create(
        &mut self,
        timestamp: u64,
        d: &SyncCreateEvent,
        prices: &PricesComponent,
        assets: &mut AssetsComponent,
    ) {
        if self.address_to_index.contains_key(&d.sync) {
            eprintln!("warning: duplicate SyncCreate for {}", d.sync);
            return;
        }

        // Calculate initial price from virtual reserves
        let initial_sol_reserves = INITIAL_VIRTUAL_SOL_RESERVES as u64;
        let initial_token_reserves = INITIAL_VIRTUAL_TOKEN_RESERVES as u64;

        // Calculate initial price in USD using the bonding curve formula
        let sol_per_token =
            from_sol_amount(initial_sol_reserves) / from_token_amount(initial_token_reserves);
        let initial_price_usd = sol_per_token * prices.sol();
        let initial_mkt_cap_usd = if initial_price_usd.is_normal() {
            initial_price_usd * SYNC_MAX_SUPPLY_TOKENS
        } else {
            0.0
        };

        let sync = Sync {
            name: d.name.clone(),
            symbol: d.symbol.clone(),
            address: d.sync,
            pump_mint: d.pump_mint,
            create_timestamp: timestamp,
            metadata_url: d.metadata_url.clone(),
            icon_url: d.icon_url.clone(),
            short_desc: d.short_desc.clone(),
            game_url: d.game_url.clone(),
            is_migrated: false,
            pswap_pool: None,
            last_price_usd: initial_price_usd,
            mkt_cap_usd: initial_mkt_cap_usd,
            sol_reserves: initial_sol_reserves,
            token_reserves: initial_token_reserves,
        };

        let idx = self.syncs.len();
        let mut meta = SyncMeta::new();

        // Add initial candle to charts (similar to game.rs)
        // Using 0.0 for volume since this is just creation, not a trade
        if initial_price_usd.is_normal() {
            _ = meta.charts.append(timestamp, initial_price_usd, 0.0);
        }

        // Broadcast initial update
        meta.broadcast_update(SyncUpdate {
            sol_reserves: initial_sol_reserves,
            token_reserves: initial_token_reserves,
            mkt_cap_usd: initial_mkt_cap_usd,
            change_pct_24h: 0.0,
            is_migrated: false,
            pswap_pool: None,
        });

        // Send asset notification on creation
        _ = self.assets_tx.send(sync.to_asset());

        self.syncs.push(sync);
        self.metas.push(meta);

        // All indices point to the same index in parallel vectors
        self.address_to_index.insert(d.sync, idx);
        self.pump_mint_to_index.insert(d.pump_mint, idx);

        // Update assets component
        assets.on_sync_created(idx, initial_mkt_cap_usd, timestamp);
    }

    fn handle_pf_trade(
        &mut self,
        timestamp: u64,
        d: &PfTradeEvent,
        prices: &PricesComponent,
        assets: &mut AssetsComponent,
    ) {
        // Single lookup to get index, then direct access to both sync and metas
        let Some(&index) = self.pump_mint_to_index.get(&d.mint) else {
            return;
        };
        let s = &mut self.syncs[index];
        let meta = &mut self.metas[index];

        // ignore PF after migration
        if s.is_migrated {
            return;
        }

        // Skip zero amounts
        if d.token_amount == 0 {
            return;
        }

        // Store old market cap for asset update
        let old_mkt_cap_usd = s.mkt_cap_usd;

        // Use the gold standard calculation method from handle_pa_buy
        let sol_usd = prices.sol();
        let volume_usd = from_sol_amount(d.sol_amount) * sol_usd;
        // how many USD per token?
        let price_usd =
            (from_sol_amount(d.sol_amount) * sol_usd) / from_token_amount(d.token_amount);

        if !price_usd.is_normal() || !volume_usd.is_normal() {
            return;
        }

        _ = meta.charts.append(timestamp, price_usd, volume_usd);

        s.last_price_usd = price_usd;
        s.mkt_cap_usd = price_usd * SYNC_MAX_SUPPLY_TOKENS;

        // Update virtual reserves (these come from the PfTradeEvent)
        s.sol_reserves = d.virtual_sol_reserves;
        s.token_reserves = d.virtual_token_reserves;

        let change_pct_24h = meta.charts.get_change_pct_24h().unwrap_or(0.0);

        // Broadcast update (using virtual reserves as sol/token reserves for pre-migration)
        meta.broadcast_update(SyncUpdate {
            sol_reserves: s.sol_reserves,
            token_reserves: s.token_reserves,
            mkt_cap_usd: s.mkt_cap_usd,
            change_pct_24h,
            is_migrated: false,
            pswap_pool: None,
        });

        // Send to trades listener
        _ = self.trades_tx.send(Some(Trade {
            user: d.user,
            asset: s.address,
            symbol: s.symbol.clone(),
            icon_url: s.icon_url.clone(),
            volume_usd,
            mkt_cap_usd: s.mkt_cap_usd,
            is_buy: d.is_buy,
        }));

        // Update assets component
        if old_mkt_cap_usd != s.mkt_cap_usd {
            assets.on_sync_updated(index, old_mkt_cap_usd, s.mkt_cap_usd, s.create_timestamp);
        }
    }

    fn handle_pf_migration(&mut self, d: &PfMigrationEvent) {
        let Some(&index) = self.pump_mint_to_index.get(&d.mint) else {
            return;
        };
        let s = &mut self.syncs[index];
        s.is_migrated = true;
        s.pswap_pool = Some(d.pool);
        self.pool_to_index.insert(d.pool, index);
    }

    fn handle_pa_buy(
        &mut self,
        timestamp: u64,
        d: &PaBuyEvent,
        prices: &PricesComponent,
        assets: &mut AssetsComponent,
    ) {
        // Single lookup to get index, then direct access to both sync and metas
        let Some(&index) = self.pool_to_index.get(&d.pool) else {
            return;
        };
        let s = &mut self.syncs[index];
        let meta = &mut self.metas[index];

        // PA is active only post migration
        if !s.is_migrated {
            return;
        }

        // Skip zero amounts
        if d.base_amount_out == 0 {
            return;
        }

        // Store old market cap for asset update
        let old_mkt_cap_usd = s.mkt_cap_usd;

        // In PA Buy, QUOTE -> BASE (ExactOut).
        // The migrated pools are always quote=WSOL, base=TOKEN.
        let sol_usd = prices.sol();
        let volume_usd = from_sol_amount(d.quote_amount_in) * prices.sol();
        // how many USD per output token?
        let price_usd =
            (from_sol_amount(d.quote_amount_in) * sol_usd) / from_token_amount(d.base_amount_out);
        if !price_usd.is_normal() || !volume_usd.is_normal() {
            return;
        }
        _ = meta.charts.append(timestamp, price_usd, volume_usd);
        s.last_price_usd = price_usd;
        s.mkt_cap_usd = price_usd * SYNC_MAX_SUPPLY_TOKENS;

        // Update pool reserves (these come from the PaBuyEvent)
        s.sol_reserves = d.pool_quote_token_reserves;
        s.token_reserves = d.pool_base_token_reserves;

        let change_pct_24h = meta.charts.get_change_pct_24h().unwrap_or(0.0);

        // Broadcast update
        meta.broadcast_update(SyncUpdate {
            sol_reserves: s.sol_reserves,
            token_reserves: s.token_reserves,
            mkt_cap_usd: s.mkt_cap_usd,
            change_pct_24h,
            is_migrated: true,
            pswap_pool: s.pswap_pool,
        });

        // Send to trades listener
        _ = self.trades_tx.send(Some(Trade {
            user: d.user,
            asset: s.address,
            symbol: s.symbol.clone(),
            icon_url: s.icon_url.clone(),
            volume_usd,
            mkt_cap_usd: s.mkt_cap_usd,
            is_buy: true,
        }));

        // Update assets component
        if old_mkt_cap_usd != s.mkt_cap_usd {
            assets.on_sync_updated(index, old_mkt_cap_usd, s.mkt_cap_usd, s.create_timestamp);
        }
    }

    fn handle_pa_sell(
        &mut self,
        timestamp: u64,
        d: &PaSellEvent,
        prices: &PricesComponent,
        assets: &mut AssetsComponent,
    ) {
        let Some(&index) = self.pool_to_index.get(&d.pool) else {
            return;
        };
        let s = &mut self.syncs[index];
        let meta = &mut self.metas[index];

        if !s.is_migrated {
            return;
        }

        // Store old market cap for asset update
        let old_mkt_cap_usd = s.mkt_cap_usd;

        // In PA Sell, BASE -> QUOTE (ExactIn).
        // The migrated pools are always quote=WSOL, base=TOKEN.
        // Skip zero amounts
        if d.base_amount_in == 0 {
            return;
        }

        // Use the gold standard calculation method from handle_pa_buy
        let sol_usd = prices.sol();
        let volume_usd = from_sol_amount(d.quote_amount_out) * sol_usd;
        // how many USD per input token?
        let price_usd =
            (from_sol_amount(d.quote_amount_out) * sol_usd) / from_token_amount(d.base_amount_in);

        if !price_usd.is_normal() || !volume_usd.is_normal() {
            return;
        }
        _ = meta.charts.append(timestamp, price_usd, volume_usd);
        s.last_price_usd = price_usd;
        s.mkt_cap_usd = price_usd * SYNC_MAX_SUPPLY_TOKENS;

        // Update pool reserves (these come from the PaSellEvent)
        s.sol_reserves = d.pool_quote_token_reserves;
        s.token_reserves = d.pool_base_token_reserves;

        let change_pct_24h = meta.charts.get_change_pct_24h().unwrap_or(0.0);

        // Broadcast update
        meta.broadcast_update(SyncUpdate {
            sol_reserves: s.sol_reserves,
            token_reserves: s.token_reserves,
            mkt_cap_usd: s.mkt_cap_usd,
            change_pct_24h,
            is_migrated: true,
            pswap_pool: s.pswap_pool,
        });

        // Send to trades listener
        _ = self.trades_tx.send(Some(Trade {
            user: d.user,
            asset: s.address,
            symbol: s.symbol.clone(),
            icon_url: s.icon_url.clone(),
            volume_usd,
            mkt_cap_usd: s.mkt_cap_usd,
            is_buy: false,
        }));

        // Update assets component
        if old_mkt_cap_usd != s.mkt_cap_usd {
            assets.on_sync_updated(index, old_mkt_cap_usd, s.mkt_cap_usd, s.create_timestamp);
        }
    }

    // --- Queries / helpers ---
    pub fn get_sync_by_address(&self, address: &Public) -> Option<Sync> {
        self.address_to_index
            .get(address)
            .map(|&index| self.syncs[index].clone())
    }

    pub fn query_sync_chart(
        &self,
        sync: Public,
        kind: ChartKind,
        count: usize,
        until_inclusive: u64,
    ) -> Vec<Candle> {
        match self.address_to_index.get(&sync) {
            Some(&index) => self.metas[index].charts.query(kind, count, until_inclusive),
            None => Vec::new(),
        }
    }
}
