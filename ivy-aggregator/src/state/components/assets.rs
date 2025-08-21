use std::collections::BTreeSet;

use crate::state::constants::{
    MAX_FEATURED_ASSETS, MAX_HOT_ASSETS, MAX_HOT_ASSET_AGE, MIN_HOT_ASSET_COUNT,
};
use crate::state::helpers::{calculate_hot_score, normalize_string};
use crate::types::asset::Asset;
use std::time::SystemTime;

use super::games::GamesComponent;
use super::sync::SyncComponent;

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct TopAssetEntry {
    mkt_cap_usd_cents: u64, // Store as cents to avoid float comparison
    create_timestamp: u64,
    index: usize,
    is_sync: bool,
}

pub struct AssetsComponent {
    pub top_assets: BTreeSet<TopAssetEntry>,
    pub hot_asset_indices: Vec<(usize, bool)>, // (index, is_sync)
}

impl AssetsComponent {
    pub fn new() -> Self {
        Self {
            top_assets: BTreeSet::new(),
            hot_asset_indices: Vec::new(),
        }
    }

    /// Called when a new game is created
    pub fn on_game_created(&mut self, index: usize, mkt_cap_usd: f32, create_timestamp: u64) {
        self.top_assets.insert(TopAssetEntry {
            mkt_cap_usd_cents: (mkt_cap_usd * 100.0) as u64,
            create_timestamp,
            index,
            is_sync: false,
        });
    }

    /// Called when a game's market cap changes (e.g., after a swap)
    pub fn on_game_updated(
        &mut self,
        index: usize,
        old_mkt_cap_usd: f32,
        new_mkt_cap_usd: f32,
        create_timestamp: u64,
    ) {
        // Remove old entry
        self.top_assets.remove(&TopAssetEntry {
            mkt_cap_usd_cents: (old_mkt_cap_usd * 100.0) as u64,
            create_timestamp,
            index,
            is_sync: false,
        });

        // Add new entry
        self.top_assets.insert(TopAssetEntry {
            mkt_cap_usd_cents: (new_mkt_cap_usd * 100.0) as u64,
            create_timestamp,
            index,
            is_sync: false,
        });
    }

    /// Called when a new sync is created
    pub fn on_sync_created(&mut self, index: usize, mkt_cap_usd: f32, create_timestamp: u64) {
        self.top_assets.insert(TopAssetEntry {
            mkt_cap_usd_cents: (mkt_cap_usd * 100.0) as u64,
            create_timestamp,
            index,
            is_sync: true,
        });
    }

    /// Called when a sync's market cap changes
    pub fn on_sync_updated(
        &mut self,
        index: usize,
        old_mkt_cap_usd: f32,
        new_mkt_cap_usd: f32,
        create_timestamp: u64,
    ) {
        // Remove old entry
        self.top_assets.remove(&TopAssetEntry {
            mkt_cap_usd_cents: (old_mkt_cap_usd * 100.0) as u64,
            create_timestamp,
            index,
            is_sync: true,
        });

        // Add new entry
        self.top_assets.insert(TopAssetEntry {
            mkt_cap_usd_cents: (new_mkt_cap_usd * 100.0) as u64,
            create_timestamp,
            index,
            is_sync: true,
        });
    }

    /// Calculate the hot list based on current data (uses readonly references)
    pub fn calculate_hot_list(
        &self,
        games: &GamesComponent,
        syncs: &SyncComponent,
    ) -> Vec<(usize, bool)> {
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut scored_assets: Vec<(f32, usize, bool)> = Vec::new();

        // Score games
        for (idx, game) in games.game_list.iter().enumerate().rev() {
            let age_seconds = now.saturating_sub(game.create_timestamp);
            if age_seconds > MAX_HOT_ASSET_AGE && scored_assets.len() > MIN_HOT_ASSET_COUNT {
                break;
            }
            let hot_score = calculate_hot_score(game.mkt_cap_usd, age_seconds);
            scored_assets.push((hot_score, idx, false));
        }

        // Score syncs
        for (idx, sync) in syncs.syncs.iter().enumerate().rev() {
            let age_seconds = now.saturating_sub(sync.create_timestamp);
            if age_seconds > MAX_HOT_ASSET_AGE && scored_assets.len() > MIN_HOT_ASSET_COUNT {
                break;
            }
            let hot_score = calculate_hot_score(sync.mkt_cap_usd, age_seconds);
            scored_assets.push((hot_score, idx, true));
        }

        // Sort by score descending
        scored_assets.sort_by(|a, b| b.0.total_cmp(&a.0));

        // Return the top hot assets
        scored_assets
            .into_iter()
            .take(MAX_HOT_ASSETS)
            .map(|(_, idx, is_sync)| (idx, is_sync))
            .collect()
    }

    /// Update the hot list with the provided data (requires writable reference)
    pub fn update_hot_list(&mut self, hot_list: Vec<(usize, bool)>) {
        self.hot_asset_indices = hot_list;
    }

    pub fn get_top_assets(
        &self,
        games: &GamesComponent,
        syncs: &SyncComponent,
        count: usize,
        skip: usize,
    ) -> Vec<Asset> {
        self.top_assets
            .iter()
            .rev()
            .skip(skip)
            .take(count)
            .filter_map(|entry| {
                if entry.is_sync {
                    syncs.syncs.get(entry.index).map(|s| s.to_asset())
                } else {
                    games.game_list.get(entry.index).map(|g| g.to_asset())
                }
            })
            .collect()
    }

    pub fn get_hot_assets(
        &self,
        games: &GamesComponent,
        syncs: &SyncComponent,
        count: usize,
        skip: usize,
    ) -> Vec<Asset> {
        self.hot_asset_indices
            .iter()
            .skip(skip)
            .take(count)
            .filter_map(|(idx, is_sync)| {
                if *is_sync {
                    syncs.syncs.get(*idx).map(|s| s.to_asset())
                } else {
                    games.game_list.get(*idx).map(|g| g.to_asset())
                }
            })
            .collect()
    }

    pub fn get_recent_assets(
        &self,
        games: &GamesComponent,
        syncs: &SyncComponent,
        count: usize,
        skip: usize,
    ) -> Vec<Asset> {
        // Both lists are chronologically ordered (newest at the end)
        // We'll iterate backwards and merge them
        let mut result = Vec::with_capacity(count);
        let mut skipped = 0;

        // Start from the end of both lists
        let mut game_idx = games.game_list.len();
        let mut sync_idx = syncs.syncs.len();

        while result.len() < count && (game_idx > 0 || sync_idx > 0) {
            // Peek at the next game and sync
            let game_timestamp = if game_idx > 0 {
                games.game_list[game_idx - 1].create_timestamp
            } else {
                0
            };

            let sync_timestamp = if sync_idx > 0 {
                syncs.syncs[sync_idx - 1].create_timestamp
            } else {
                0
            };

            // Take the more recent one
            let asset = if game_idx > 0 && (sync_idx == 0 || game_timestamp >= sync_timestamp) {
                game_idx -= 1;
                games.game_list[game_idx].to_asset()
            } else if sync_idx > 0 {
                sync_idx -= 1;
                syncs.syncs[sync_idx].to_asset()
            } else {
                break;
            };

            // Apply skip
            if skipped < skip {
                skipped += 1;
                continue;
            }

            result.push(asset);
        }

        result
    }

    pub fn search_recent_assets_by_name(
        &self,
        games: &GamesComponent,
        syncs: &SyncComponent,
        name: &str,
        count: usize,
        skip: usize,
    ) -> Vec<Asset> {
        let query = normalize_string(name);
        if query.is_empty() {
            return Vec::new();
        }

        let mut result = Vec::with_capacity(count);
        let mut skipped = 0;

        // Start from the end of both lists (most recent)
        let mut game_idx = games.game_list.len();
        let mut sync_idx = syncs.syncs.len();

        while result.len() < count && (game_idx > 0 || sync_idx > 0) {
            // Peek at the next game and sync timestamps
            let game_timestamp = if game_idx > 0 {
                games.game_list[game_idx - 1].create_timestamp
            } else {
                0
            };

            let sync_timestamp = if sync_idx > 0 {
                syncs.syncs[sync_idx - 1].create_timestamp
            } else {
                0
            };

            // Process the more recent one
            if game_idx > 0 && (sync_idx == 0 || game_timestamp >= sync_timestamp) {
                game_idx -= 1;
                let game = &games.game_list[game_idx];

                if game.normalized_name.contains(&query) {
                    if skipped < skip {
                        skipped += 1;
                    } else {
                        result.push(game.to_asset());
                    }
                }
            } else if sync_idx > 0 {
                sync_idx -= 1;
                let sync = &syncs.syncs[sync_idx];

                // For syncs, we normalize the name on the fly
                let normalized_sync_name = normalize_string(&sync.name);
                if normalized_sync_name.contains(&query) {
                    if skipped < skip {
                        skipped += 1;
                    } else {
                        result.push(sync.to_asset());
                    }
                }
            }
        }

        result
    }

    pub fn search_top_assets_by_name(
        &self,
        games: &GamesComponent,
        syncs: &SyncComponent,
        name: &str,
        count: usize,
        skip: usize,
    ) -> Vec<Asset> {
        let query = normalize_string(name);
        if query.is_empty() {
            return Vec::new();
        }

        self.top_assets
            .iter()
            .rev()
            .filter_map(|entry| {
                if entry.is_sync {
                    syncs.syncs.get(entry.index).and_then(|sync| {
                        let normalized_sync_name = normalize_string(&sync.name);
                        if normalized_sync_name.contains(&query) {
                            Some(sync.to_asset())
                        } else {
                            None
                        }
                    })
                } else {
                    games.game_list.get(entry.index).and_then(|game| {
                        if game.normalized_name.contains(&query) {
                            Some(game.to_asset())
                        } else {
                            None
                        }
                    })
                }
            })
            .skip(skip)
            .take(count)
            .collect()
    }

    pub fn get_asset_count(&self, games: &GamesComponent, syncs: &SyncComponent) -> usize {
        games.game_list.len() + syncs.syncs.len()
    }

    pub fn get_featured_assets(&self, games: &GamesComponent, syncs: &SyncComponent) -> Vec<Asset> {
        self.top_assets
            .iter() // lo->hi
            .rev() // hi->lo
            .take(MAX_FEATURED_ASSETS)
            .map(|x| {
                if x.is_sync {
                    syncs.syncs[x.index].to_asset()
                } else {
                    games.game_list[x.index].to_asset()
                }
            })
            .collect()
    }
}
