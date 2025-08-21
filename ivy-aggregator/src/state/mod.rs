use std::sync::RwLock;

pub mod components;
pub mod constants;
pub mod helpers;
pub mod types;

use crate::types::{asset::Asset, event::Event, trade::Trade};
use components::{
    assets::AssetsComponent, games::GamesComponent, pnl::PnlComponent, prices::PricesComponent,
    receipts::ReceiptsComponent, sync::SyncComponent, volume::VolumeComponent,
    world::WorldComponent,
};
use constants::MAX_CANDLES;
use tokio::sync::{broadcast, watch};

// 64 new assets before receiver is deemed lagged
const ASSETS_CHANNEL_BUFFER_SIZE: usize = 64;

pub type State = RwLock<StateData>;

pub struct StateData {
    pub assets: AssetsComponent,
    pub assets_rx: broadcast::Receiver<Asset>,
    pub games: GamesComponent,
    pub pnl: PnlComponent,
    pub prices: PricesComponent,
    pub receipts: ReceiptsComponent,
    pub syncs: SyncComponent,
    pub trades_rx: watch::Receiver<Option<Trade>>,
    pub volume: VolumeComponent,
    pub world: WorldComponent,
}

impl StateData {
    pub fn new() -> StateData {
        let (trades_tx, trades_rx) = watch::channel(None);
        let (assets_tx, assets_rx) = broadcast::channel(ASSETS_CHANNEL_BUFFER_SIZE);
        StateData {
            assets: AssetsComponent::new(),
            assets_rx,
            games: GamesComponent::new(MAX_CANDLES, trades_tx.clone(), assets_tx.clone()),
            pnl: PnlComponent::new(),
            prices: PricesComponent::new(),
            receipts: ReceiptsComponent::new(),
            syncs: SyncComponent::new(trades_tx, assets_tx),
            trades_rx,
            volume: VolumeComponent::new(60 * 24),
            world: WorldComponent::new(MAX_CANDLES),
        }
    }

    pub fn on_event(&mut self, event: &Event) -> bool {
        let mut used = false;
        used |= self.games.on_event(event, &self.world, &mut self.assets);
        used |= self.pnl.on_event(event, &self.world, &self.prices);
        used |= self.prices.on_event(event);
        used |= self.receipts.on_event(event);
        used |= self.syncs.on_event(event, &self.prices, &mut self.assets);
        used |= self.volume.on_event(event, &self.world, &self.prices);
        used |= self.world.on_event(event);

        used
    }
}
