use crate::sqrt_curve::SqrtCurve;
use crate::types::chart::Candle;
use crate::types::charts::{ChartKind, Charts};
use crate::types::event::{
    Event, EventData, WorldCreateEvent, WorldSwapEvent, WorldUpdateEvent, WorldVestingEvent,
};
use crate::types::signature::Signature;
use crate::util::{from_ivy_amount, from_usdc_amount};
use serde::Serialize;
use tokio::sync::broadcast;

// 512 updates before receiver is deemed lagged :)
const CHANNEL_BUFFER_SIZE: usize = 512;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct WorldBalanceUpdate {
    pub ivy_sold: u64,
}

#[derive(Clone, Copy)]
pub struct WorldData {
    pub usdc_balance: u64,
    pub ivy_sold: u64,
    pub ivy_vested: u64,
    pub create_timestamp: u64,
    pub ivy_curve_max: u64,
    pub curve_input_scale_num: u32,
    pub curve_input_scale_den: u32,
    pub ivy_initial_liquidity: u64,
    pub game_initial_liquidity: u64,
    pub ivy_fee_bps: u8,
    pub game_fee_bps: u8,
}

pub struct WorldComponent {
    pub data: WorldData,
    pub ivy_charts: Charts,
    pub ivy_price: f32,
    // right now, we subscribe to every single world trade,
    // if in the future this becomes overwhelming, we can modify
    // it such that it only sends the updated balance if it's, say,
    // more than 0.1% different from the last sent value
    update_tx: Option<broadcast::Sender<WorldBalanceUpdate>>,
}

impl WorldComponent {
    pub fn new(max_candles: usize) -> Self {
        Self {
            data: WorldData {
                usdc_balance: 0,
                ivy_sold: 0,
                ivy_vested: 0,
                create_timestamp: 0,
                ivy_curve_max: 1,
                curve_input_scale_num: 1,
                curve_input_scale_den: 1,
                ivy_initial_liquidity: 0,
                game_initial_liquidity: 0,
                ivy_fee_bps: 0,
                game_fee_bps: 0,
            },
            ivy_charts: Charts::new(max_candles),
            ivy_price: 0.0,
            update_tx: None,
        }
    }

    /// Subscribe to real-time world balance updates.
    /// Returns a receiver that will receive a `WorldBalanceUpdate` every time
    /// the usdc_balance or ivy_sold changes (typically on swaps).
    pub fn subscribe(&mut self) -> broadcast::Receiver<WorldBalanceUpdate> {
        match &self.update_tx {
            None => {
                let (tx, rx) = broadcast::channel(CHANNEL_BUFFER_SIZE);
                self.update_tx = Some(tx);
                rx
            }
            Some(tx) => tx.subscribe(),
        }
    }

    /// Broadcast the balance update to our subscribers,
    /// dropping the channel if there are none left to save memory!
    fn broadcast_update(&mut self, update: WorldBalanceUpdate) {
        if let Some(tx) = &self.update_tx {
            match tx.send(update) {
                Err(_) => {
                    // No receivers
                    self.update_tx = None;
                }
                _ => {}
            }
        }
    }

    pub fn on_event(&mut self, event: &Event) -> bool {
        match &event.data {
            EventData::WorldCreate(create) => {
                self.process_world_create(event.timestamp, create);
                true
            }
            EventData::WorldUpdate(update) => {
                self.process_world_update(update);
                true
            }
            EventData::WorldSwap(swap) => {
                self.process_world_swap(event.timestamp, &event.signature, swap);
                true
            }
            EventData::WorldVesting(vest) => {
                self.process_world_vesting(vest);
                true
            }
            _ => false,
        }
    }

    fn process_world_create(&mut self, timestamp: u64, create_data: &WorldCreateEvent) {
        self.data.create_timestamp = timestamp;
        self.data.ivy_curve_max = create_data.ivy_curve_max;
        self.data.curve_input_scale_num = create_data.curve_input_scale_num;
        self.data.curve_input_scale_den = create_data.curve_input_scale_den;
    }

    fn process_world_update(&mut self, update_data: &WorldUpdateEvent) {
        self.data.ivy_initial_liquidity = update_data.ivy_initial_liquidity;
        self.data.game_initial_liquidity = update_data.game_initial_liquidity;
        self.data.ivy_fee_bps = update_data.ivy_fee_bps;
        self.data.game_fee_bps = update_data.game_fee_bps;
    }

    fn process_world_swap(
        &mut self,
        timestamp: u64,
        signature: &Signature,
        swap_data: &WorldSwapEvent,
    ) {
        let usdc_amount = from_usdc_amount(swap_data.usdc_amount);

        let ivy_price = SqrtCurve::current_price(
            from_ivy_amount(swap_data.ivy_sold) as f64,
            (self.data.curve_input_scale_num as f64) / (self.data.curve_input_scale_den as f64),
        ) as f32;

        if !ivy_price.is_normal() {
            return;
        }

        self.ivy_price = ivy_price;
        self.data.usdc_balance = swap_data.usdc_balance;
        self.data.ivy_sold = swap_data.ivy_sold;

        // Broadcast the balance update to subscribers
        let update = WorldBalanceUpdate {
            ivy_sold: swap_data.ivy_sold,
        };
        self.broadcast_update(update);

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

    fn process_world_vesting(&mut self, vesting_data: &WorldVestingEvent) {
        self.data.ivy_vested = vesting_data.ivy_vested;
    }

    pub fn price(&self) -> f32 {
        self.ivy_price
    }

    pub fn query_ivy_chart(
        &self,
        kind: ChartKind,
        count: usize,
        after_inclusive: u64,
    ) -> Vec<Candle> {
        self.ivy_charts.query(kind, count, after_inclusive)
    }

    pub fn ivy_change_24h(&self) -> f32 {
        self.ivy_charts.get_change_pct_24h().unwrap_or(0.0)
    }

    pub fn data(&self) -> WorldData {
        self.data
    }
}
