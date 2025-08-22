use crate::types::event::{Event, EventData, SolPriceEvent};
use crate::types::signature::Signature;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use ureq::Agent;

const SOL_PRICE_INTERVAL: Duration = Duration::from_secs(60);

pub struct Pricer {
    api_url: String,
    retriever_tx: mpsc::Sender<Vec<Event>>,
    agent: Agent,
}

impl Pricer {
    pub fn new(api_url: String, retriever_tx: mpsc::Sender<Vec<Event>>, agent: Agent) -> Self {
        Self {
            api_url,
            retriever_tx,
            agent,
        }
    }

    pub fn run(self) {
        // Fetch initial price
        self.fetch_and_send_price();

        // Then fetch every 60 seconds
        loop {
            thread::sleep(SOL_PRICE_INTERVAL);
            self.fetch_and_send_price();
        }
    }

    fn fetch_and_send_price(&self) {
        let url = format!("{}/sol-price", self.api_url);

        let response = match self.agent.get(&url).call() {
            Ok(response) => response,
            Err(e) => {
                eprintln!("Pricer: Failed to fetch SOL price: {}", e);
                return;
            }
        };

        let json = match response.into_body().read_json::<serde_json::Value>() {
            Ok(json) => json,
            Err(e) => {
                eprintln!("Pricer: Failed to parse JSON response: {}", e);
                return;
            }
        };

        let status = match json.get("status") {
            Some(status) => status,
            None => {
                eprintln!("Pricer: Invalid response format");
                return;
            }
        };

        if status == "ok" {
            let price = match json.get("data").and_then(|d| d.as_f64()) {
                Some(price) => price,
                None => {
                    eprintln!("Pricer: Invalid price data in response");
                    return;
                }
            };

            let event = Event {
                data: EventData::SolPrice(SolPriceEvent { price }),
                signature: Signature::zero(), // No signature for price events
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
            };

            if let Err(e) = self.retriever_tx.send(vec![event]) {
                eprintln!("Pricer: Failed to send price event: {}", e);
            }
        } else if let Some(msg) = json.get("msg").and_then(|m| m.as_str()) {
            eprintln!("Pricer: API error: {}", msg);
        } else {
            eprintln!("Pricer: Unknown API error");
        }
    }
}
