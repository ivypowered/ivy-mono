use crate::types::chart::{Candle, Chart, ChartError};
use serde::Deserialize;
use tokio::sync::broadcast;

// First, add this derive to the ChartKind enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[repr(u8)]
pub enum ChartKind {
    #[serde(rename = "1m")]
    M1 = 0,
    #[serde(rename = "5m")]
    M5,
    #[serde(rename = "15m")]
    M15,
    #[serde(rename = "1h")]
    H1,
    #[serde(rename = "1d")]
    D1,
    #[serde(rename = "1w")]
    W1,
}

impl std::str::FromStr for ChartKind {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "1m" => Ok(ChartKind::M1),
            "5m" => Ok(ChartKind::M5),
            "15m" => Ok(ChartKind::M15),
            "1h" => Ok(ChartKind::H1),
            "1d" => Ok(ChartKind::D1),
            "1w" => Ok(ChartKind::W1),
            _ => Err(format!("Unknown chart kind: {}", s)),
        }
    }
}

impl ChartKind {
    pub const COUNT: usize = 6;
}

pub struct Charts {
    pub charts: [Chart; ChartKind::COUNT],
}

impl Charts {
    pub fn new(max_candles: usize) -> Self {
        Self {
            charts: [
                Chart::new(60 * 1, max_candles),           // 1 minute
                Chart::new(60 * 5, max_candles),           // 5 minutes
                Chart::new(60 * 15, max_candles),          // 15 minutes
                Chart::new(60 * 60, max_candles),          // 1 hour
                Chart::new(60 * 60 * 24, max_candles),     // 1 day
                Chart::new(60 * 60 * 24 * 7, max_candles), // 1 week
            ],
        }
    }

    pub fn append(&mut self, timestamp: u64, price: f32, volume: f32) -> Result<(), ChartError> {
        self.charts[ChartKind::M1 as usize].append(timestamp, price, volume)?;
        self.charts[ChartKind::M5 as usize].append(timestamp, price, volume)?;
        self.charts[ChartKind::M15 as usize].append(timestamp, price, volume)?;
        self.charts[ChartKind::H1 as usize].append(timestamp, price, volume)?;
        self.charts[ChartKind::D1 as usize].append(timestamp, price, volume)?;
        self.charts[ChartKind::W1 as usize].append(timestamp, price, volume)?;

        Ok(())
    }

    pub fn query(&self, kind: ChartKind, count: usize, after_inclusive: u64) -> Vec<Candle> {
        self.charts[kind as usize].query(count, after_inclusive)
    }

    /// Gets the change percent in the last 24h, if we have it
    pub fn get_change_pct_24h(&self) -> Option<f32> {
        for c in &self.charts {
            match c.get_change_pct_24h() {
                Some(v) => return Some(v),
                None => {}
            }
        }
        None
    }

    /// Subscribe to updates for a specific chart kind
    pub fn subscribe_to_kind(&mut self, kind: ChartKind) -> broadcast::Receiver<Candle> {
        self.charts[kind as usize].subscribe()
    }
}
