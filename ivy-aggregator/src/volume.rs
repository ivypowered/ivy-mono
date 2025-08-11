use std::collections::VecDeque;

/// Keeps track of the volume of the trades provided
/// within the last `n` minutes.
pub struct Volume {
    /// A buffer of `n` minutes,
    /// containing the volume amount
    /// for each
    minutes: VecDeque<u64>,
    /// The current rolling volume amount
    amount: u64,
    /// The start timestamp of `minutes[-1]`
    last_timestamp: u64,
}

impl Volume {
    pub fn new(n: usize) -> Volume {
        if n == 0 {
            panic!("volume can't be passed 0 as buf size");
        }
        Volume {
            minutes: VecDeque::with_capacity(n),
            amount: 0,
            last_timestamp: 0,
        }
    }

    /// Gets the total volume of all trades provided
    /// within the last `n` minutes
    pub fn get(&self) -> u64 {
        return self.amount;
    }

    /// Append a new trade to the volume queue
    pub fn append(&mut self, volume: u64, timestamp: u64) {
        // normalize this timestamp to minute boundaries
        let timestamp = (timestamp / 60) * 60;
        // initialize if this is our first
        if self.last_timestamp == 0 {
            self.amount = volume;
            self.minutes.push_back(volume);
            self.last_timestamp = timestamp;
            return;
        }
        // otherwise, add new minutes if we have to in order to get
        // to the current minute
        // note: this silently handles timestamps in non-chronological
        // order by assuming they're part of the last timestamp :)
        while self.last_timestamp < timestamp {
            if self.minutes.len() >= self.minutes.capacity() {
                // would go over buffer limit, remove last candle
                self.amount = self
                    .amount
                    .saturating_sub(self.minutes.pop_front().unwrap_or(0));
            }
            self.minutes.push_back(0);
            self.last_timestamp += 60;
        }
        // modify current minute with new volume
        *self.minutes.back_mut().unwrap() += volume;
        self.amount = self.amount.saturating_add(volume);
    }
}
