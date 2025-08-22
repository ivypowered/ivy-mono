use crate::types::event::{
    Event, EventData, GameEditEvent, HydrateEvent, InitializeEvent, SyncCreateEvent,
};
use crate::types::public::Public;
use std::collections::HashMap;
use std::sync::mpsc::Sender;

/// State component: collects metadata_url by asset pre-initialization,
/// drains and sends to worker after InitializeEvent, and immediately
/// forwards new metadata_url updates after initialization.
pub struct HydrateComponent {
    initialized: bool,
    pending: HashMap<Public, String>, // asset -> metadata_url
    tx: Sender<(Public, String)>,     // hydration requests to worker
}

impl HydrateComponent {
    pub fn new(tx: Sender<(Public, String)>) -> Self {
        Self {
            initialized: false,
            pending: HashMap::new(),
            tx,
        }
    }

    pub fn on_event(&mut self, event: &Event) -> bool {
        match &event.data {
            // During replay/pre-initialization: track latest metadata_url
            EventData::GameEdit(GameEditEvent {
                game, metadata_url, ..
            }) => {
                if metadata_url.is_empty() {
                    return false;
                }
                if !self.initialized {
                    self.pending.insert(*game, metadata_url.clone());
                } else {
                    let _ = self.tx.send((*game, metadata_url.clone()));
                }
                false
            }
            EventData::SyncCreate(SyncCreateEvent {
                sync, metadata_url, ..
            }) => {
                if metadata_url.is_empty() {
                    return false;
                }
                if !self.initialized {
                    self.pending.insert(*sync, metadata_url.clone());
                } else {
                    let _ = self.tx.send((*sync, metadata_url.clone()));
                }
                false
            }

            // While pre-initialization, we use HydrateEvent as dedupe to clear finished jobs.
            EventData::Hydrate(HydrateEvent {
                asset,
                metadata_url,
                ..
            }) => {
                if !self.initialized {
                    if let Some(cur) = self.pending.get(asset) {
                        if cur == metadata_url {
                            self.pending.remove(asset);
                        }
                    }
                }
                false
            }

            // Switching mode: drain the map to the worker and ignore HydrateEvents thereafter.
            EventData::Initialize(InitializeEvent {}) => {
                self.initialized = true;
                for (asset, url) in self.pending.drain() {
                    let _ = self.tx.send((asset, url));
                }
                false
            }
            _ => false,
        }
    }
}
