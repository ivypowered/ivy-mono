use std::sync::mpsc::{Receiver, Sender};
use std::{thread, time::Duration};

use serde::Deserialize;
use ureq::Agent;

use crate::types::event::{Event, EventData, HydrateEvent};
use crate::types::public::Public;
use crate::types::signature::Signature;
use crate::util::unix_timestamp;

/// Worker/process that fetches metadata (with infinite retry)
/// and emits HydrateEvent into the normal events pipeline.
pub struct Hydrator {
    rx: Receiver<(Public, String)>, // (asset, metadata_url)
    events_tx: Sender<Vec<Event>>,  // events stream (same channel used by Retriever->Applier)
    api_url: String,                // backend base URL (e.g. http://127.0.0.1:4000)
    agent: Agent,                   // HTTP client
}

impl Hydrator {
    pub fn new(
        api_url: String,
        rx: Receiver<(Public, String)>,
        events_tx: Sender<Vec<Event>>,
        agent: Agent,
    ) -> Self {
        Self {
            rx,
            events_tx,
            api_url,
            agent,
        }
    }

    pub fn run(self) {
        let Hydrator {
            rx,
            events_tx,
            api_url,
            agent,
        } = self;

        while let Ok((asset, metadata_url)) = rx.recv() {
            // Infinite retry loop
            loop {
                match Self::fetch_metadata(&agent, &api_url, &metadata_url) {
                    Ok(metadata) => {
                        // metadata is None means invalid (non-retryable),
                        // Some means we got valid data
                        let (description, icon_url) =
                            metadata.unwrap_or((String::new(), String::new()));

                        let event = Event {
                            data: EventData::Hydrate(HydrateEvent {
                                asset,
                                metadata_url: metadata_url.clone(),
                                description,
                                icon_url,
                            }),
                            signature: Signature::zero(),
                            timestamp: unix_timestamp(),
                        };
                        if let Err(e) = events_tx.send(vec![event]) {
                            eprintln!("Hydrator: failed to send HydrateEvent to events tx: {}", e);
                        }
                        break;
                    }
                    Err(e) => {
                        // Only retry on actual errors (network issues, etc.)
                        eprintln!(
                            "Hydrator: failed to fetch metadata for {}: {}. Retrying...",
                            asset, e
                        );
                        thread::sleep(Duration::from_millis(500));
                    }
                }
            }
        }
    }

    fn fetch_metadata(
        agent: &Agent,
        api_url: &str,
        url: &str,
    ) -> Result<Option<(String, String)>, Box<dyn std::error::Error>> {
        #[derive(Deserialize)]
        struct WebMetadata {
            description: Option<String>,
            image: Option<String>,
        }

        #[derive(Deserialize)]
        #[serde(tag = "status", rename_all = "lowercase")]
        enum ApiResponse {
            Ok { data: Option<WebMetadata> },
            Err { msg: String },
        }

        let resp = agent
            .post(&format!("{}/web-metadata", api_url.trim_end_matches('/')))
            .send_json(serde_json::json!({ "url": url }))?;

        let body = resp.into_body().read_json::<ApiResponse>()?;

        match body {
            ApiResponse::Ok { data: None } => {
                // Valid response but no metadata available (non-retryable)
                Ok(None)
            }
            ApiResponse::Ok {
                data: Some(metadata),
            } => {
                // Valid response with metadata
                Ok(Some((
                    metadata.description.unwrap_or_default(),
                    metadata.image.unwrap_or_default(),
                )))
            }
            ApiResponse::Err { msg } => {
                // Error from upstream (retryable)
                Err(format!("Upstream error: {}", msg).into())
            }
        }
    }
}
