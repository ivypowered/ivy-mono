use serde::Serialize;
use std::collections::VecDeque;
use std::error::Error;
use std::{f32, fmt};

#[derive(Debug)]
pub enum ChartError {
    ChronologyViolation,
    NotANumberProvided,
}

impl fmt::Display for ChartError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ChartError::ChronologyViolation => {
                write!(f, "trade timestamp before last candle close time")
            }
            ChartError::NotANumberProvided => write!(f, "a NaN was provided to the chart"),
        }
    }
}

impl Error for ChartError {}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Candle {
    pub open_time: u64,
    pub open: f32,
    pub high: f32,
    pub low: f32,
    pub close: f32,
    pub volume: f32,
    pub trades: u32,
}

pub struct Chart {
    candles: VecDeque<Candle>,
    interval: u64,
    max_candles: usize,
    // Index of the last candle that is >= 24h older
    // than the newest candle.
    // Or, 0 if no candles have been dropped;
    // this allows us to interpret the 24h candle of a newly
    // created token as the leftmost candle.
    index_24h: Option<usize>,
    candles_dropped: bool,
}

impl Chart {
    pub fn new(interval: u64, max_candles: usize) -> Self {
        Self {
            candles: VecDeque::new(),
            interval,
            max_candles,
            index_24h: None,
            candles_dropped: false,
        }
    }

    /// Updates the index of our "24h candle".
    fn update_index_24h(&mut self) {
        if self.candles.len() <= 1 {
            self.index_24h = None;
            return;
        }

        let last_candle_time = self.candles.back().unwrap().open_time;
        let t_minus_24h = last_candle_time.saturating_sub(60 * 60 * 24);

        let start_index = self.index_24h.unwrap_or(0);
        let mut best_index = None;
        for (i, candle) in self.candles.range(start_index + 1..).enumerate() {
            // This candle is 24 hours or older;
            // it is a better candidate for our 24h candle.
            if candle.open_time <= t_minus_24h {
                best_index = Some(start_index + i);
            }
        }

        if !self.candles_dropped {
            // 24h candle is either the true 24h
            // candle, or the first candle ever.
            self.index_24h = Some(best_index.unwrap_or(0));
        } else {
            // candles have been dropped,
            // 24h candle must be the true 24h candle
            // or bust!
            self.index_24h = best_index;
        }
    }

    /// Gets the change in 24h
    pub fn get_change_pct_24h(&self) -> Option<f32> {
        let price_24h = self.candles[self.index_24h?].close;
        let price_now = self.candles.back()?.close;
        Some(match price_24h {
            0.0 => f32::INFINITY,
            _ => ((price_now - price_24h) / price_24h) * 100.0,
        })
    }

    pub fn append(&mut self, timestamp: u64, price: f32, volume: f32) -> Result<(), ChartError> {
        // Validate inputs
        if price.is_nan() || volume.is_nan() {
            return Err(ChartError::NotANumberProvided);
        }

        let candle_start = (timestamp / self.interval) * self.interval;

        // Process the trade data
        if self.candles.is_empty() {
            // First candle ever
            self.candles.push_back(Candle {
                open_time: candle_start,
                open: price,
                high: price,
                low: price,
                close: price,
                volume,
                trades: 1,
            });
            // Update 24h candle cache
            self.update_index_24h();
        } else if let Some(last_candle) = self.candles.back_mut() {
            if candle_start < last_candle.open_time {
                // Chronology violation
                return Err(ChartError::ChronologyViolation);
            } else if candle_start == last_candle.open_time {
                // Update existing candle
                last_candle.high = last_candle.high.max(price);
                last_candle.low = last_candle.low.min(price);
                last_candle.close = price;
                last_candle.volume += volume;
                last_candle.trades = last_candle.trades.saturating_add(1);
            } else {
                // Create new candle
                let new_candle = Candle {
                    open_time: candle_start,
                    open: last_candle.close,
                    high: last_candle.close.max(price),
                    low: last_candle.close.min(price),
                    close: price,
                    volume,
                    trades: 1,
                };

                // Remove oldest candle if at capacity
                if self.candles.len() >= self.max_candles {
                    self.candles.pop_front();

                    // Adjust the 24h ago index
                    if let Some(idx) = self.index_24h {
                        self.index_24h = match idx {
                            0 => None,
                            i => Some(i - 1),
                        };
                    }

                    // We've now dropped some candles
                    self.candles_dropped = true;
                }

                // Add new candle to deque
                self.candles.push_back(new_candle);

                // Update 24h candle index
                self.update_index_24h();
            }
        }

        Ok(())
    }

    // Query returns a slice of candles in chronological order (oldest to newest).
    // count: maximum number of candles to return; drops past candles first
    // after_inclusive: only include candles with this timestamp or later
    pub fn query(&self, count: usize, after_inclusive: u64) -> Vec<Candle> {
        let len = self.candles.len();
        if len == 0 {
            return Vec::new();
        }

        // Determine the starting position based on the query parameters
        let mut position = if after_inclusive == 0 {
            // Start at zero
            0
        } else {
            // Find the first candle with open_time >= after_inclusive
            if self.candles.back().map(|x| x.open_time) == Some(after_inclusive) {
                // Common case: frontend hot update
                len - 1
            } else if len >= 2
                && self.candles.get(len - 2).map(|x| x.open_time) == Some(after_inclusive)
            {
                // Common case: frontend hot update
                len - 2
            } else {
                // Binary search for the position
                match self
                    .candles
                    .binary_search_by(|c| c.open_time.cmp(&after_inclusive))
                {
                    Ok(idx) => idx,
                    Err(idx) => {
                        if idx >= len {
                            return Vec::new(); // No candles after the given time
                        }
                        idx
                    }
                }
            }
        };

        let diff = (len - position).saturating_sub(count);
        if diff > 0 {
            // shift position upwards, dropping past elements,
            // so that we only take `count`.
            position += diff;
        }

        // Calculate how many elements to extract
        let result_len = len - position;
        let mut result = Vec::with_capacity(result_len);

        // Extract elements from the VecDeque
        let (a, b) = self.candles.as_slices();

        if position >= a.len() {
            // All elements are in the second slice
            let second_slice_index = position - a.len();
            let end_index = (second_slice_index + result_len).min(b.len());
            result.extend_from_slice(&b[second_slice_index..end_index]);
        } else if position + result_len <= a.len() {
            // All elements are in the first slice
            result.extend_from_slice(&a[position..position + result_len]);
        } else {
            // Elements span both slices
            result.extend_from_slice(&a[position..]);
            let remaining = result_len - (a.len() - position);
            result.extend_from_slice(&b[..remaining.min(b.len())]);
        }

        result
    }
}
