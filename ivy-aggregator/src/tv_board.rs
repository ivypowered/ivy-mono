use std::cmp::Reverse;
use std::collections::{BTreeSet, HashMap};

use serde::Serialize;

use crate::public::Public;

#[derive(Debug, Clone, Copy, Default, Serialize)]
pub struct Tv {
    pub personal: u64,
    pub referred: u64,
}

impl Tv {
    pub fn total(&self) -> u64 {
        self.personal + self.referred
    }
}

#[derive(Debug)]
pub struct TvBoard {
    // User -> volume mapping for O(1) lookups
    volumes: HashMap<Public, Tv>,
    // (total volume, user) sorted set for O(log n) operations
    sorted: BTreeSet<(Reverse<u64>, Public)>,
}

// Represents an entry in the tv board
#[derive(Serialize)]
pub struct TvEntry {
    user: Public,
    personal: u64,
    referred: u64,
}

impl TvBoard {
    pub fn new() -> Self {
        Self {
            volumes: HashMap::new(),
            sorted: BTreeSet::new(),
        }
    }

    pub fn add_personal_volume(&mut self, user: Public, volume: u64) {
        let current = self.volumes.get(&user).copied().unwrap_or(Tv {
            personal: 0,
            referred: 0,
        });

        // Remove old entry from sorted set
        self.sorted
            .remove(&(Reverse(current.total()), user.clone()));

        // Update volume
        let new_volume = Tv {
            personal: current.personal + volume,
            referred: current.referred,
        };

        // Insert updated entries
        self.volumes.insert(user.clone(), new_volume);
        self.sorted.insert((Reverse(new_volume.total()), user));
    }

    pub fn add_referred_volume(&mut self, user: Public, volume: u64) {
        let current = self.volumes.get(&user).copied().unwrap_or(Tv {
            personal: 0,
            referred: 0,
        });

        // Remove old entry from sorted set
        self.sorted
            .remove(&(Reverse(current.total()), user.clone()));

        // Update volume
        let new_volume = Tv {
            personal: current.personal,
            referred: current.referred + volume,
        };

        // Insert updated entries
        self.volumes.insert(user.clone(), new_volume);
        self.sorted.insert((Reverse(new_volume.total()), user));
    }

    pub fn query_descending(&self, count: usize, skip: usize) -> Vec<TvEntry> {
        self.sorted
            .iter()
            .skip(skip)
            .take(count)
            .filter_map(|(_, user)| {
                self.volumes.get(user).map(|&volume| TvEntry {
                    user: user.clone(),
                    personal: volume.personal,
                    referred: volume.referred,
                })
            })
            .collect()
    }

    pub fn get_tv(&self, user: &Public) -> Option<Tv> {
        self.volumes.get(user).copied()
    }
}
