use crate::types::event::{Event, EventData, SolPriceEvent};
use tokio::sync::watch;

pub struct PricesComponent {
    sol: f32,
    price_tx: watch::Sender<f32>,
    price_rx: watch::Receiver<f32>,
}

impl PricesComponent {
    pub fn new() -> Self {
        let (price_tx, price_rx) = watch::channel(0.0);
        Self {
            sol: 0.0,
            price_tx,
            price_rx,
        }
    }

    pub fn on_event(&mut self, event: &Event) -> bool {
        if let &EventData::SolPrice(SolPriceEvent { price }) = &event.data {
            if price.is_finite() && price > 0.0 {
                self.sol = price as f32;
                // Broadcast the new price to all watchers
                _ = self.price_tx.send(self.sol);
                return true;
            }
        }
        false
    }

    pub fn sol(&self) -> f32 {
        self.sol
    }

    /// Subscribe to real-time SOL price updates.
    /// Returns a receiver that will receive the latest SOL price whenever it changes.
    pub fn subscribe_sol(&self) -> watch::Receiver<f32> {
        self.price_rx.clone()
    }
}
