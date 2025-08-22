use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use crate::types::public::Public;
use crate::types::signature::Signature;

const BATCH_SIZE: usize = 1000; // Matches JS MAX_SIGNATURES_PER_REQUEST
const SCAN_INTERVAL_MS: u64 = 250; // Delay between polls

pub struct Scanner {
    rpc_url: String,
    program_id: Public,
    tx: mpsc::Sender<(Public, Vec<Signature>)>, // Changed to include Public
    agent: ureq::Agent,
    // Cursor: last processed (newest) signature from the previous run/batch
    last_signature: Option<Signature>,
    requires_history: bool,
}

#[derive(Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    id: serde_json::Value,
    method: &'static str,
    params: serde_json::Value,
}

#[derive(Deserialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

#[derive(Deserialize)]
struct JsonRpcResponse<T> {
    #[serde(default)]
    result: Option<T>,
    #[serde(default)]
    error: Option<JsonRpcError>,
}

#[derive(Deserialize)]
struct SignatureInfo {
    signature: Signature,
    err: Option<serde_json::Value>,
    #[serde(rename = "blockTime")]
    block_time: Option<i64>,
}

impl Scanner {
    pub fn new(
        rpc_url: &str,
        program_id: Public,
        tx: mpsc::Sender<(Public, Vec<Signature>)>, // Changed type
        agent: ureq::Agent,
        last_signature: Option<Signature>,
        requires_history: bool,
    ) -> Self {
        Self {
            rpc_url: rpc_url.to_string(),
            program_id,
            tx,
            agent,
            last_signature,
            requires_history,
        }
    }

    pub fn run(mut self) {
        let mut consecutive_failures = 0;
        loop {
            match self.poll_once() {
                Ok(()) => {
                    consecutive_failures = 0;
                }
                Err(e) => {
                    consecutive_failures += 1;
                    if consecutive_failures == 20
                        || (consecutive_failures > 20 && (consecutive_failures % 100 == 0))
                    {
                        eprintln!("Scanner: poll error no. {}: {}", consecutive_failures, e);
                    }
                }
            }
            thread::sleep(Duration::from_millis(SCAN_INTERVAL_MS));
        }
    }

    fn poll_once(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let after = self.last_signature;
        let signatures = self.get_signature_infos(after)?;
        if signatures.is_empty() {
            return Ok(());
        }

        // Update cursor to newest processed (last in chronological order)
        self.last_signature = signatures.last().cloned();

        // Send as a single chronological batch with program_id
        _ = self.tx.send((self.program_id.clone(), signatures));

        Ok(())
    }

    // Returns signature infos for a program in chronological order.
    fn get_signature_infos(
        &self,
        after: Option<Signature>,
    ) -> Result<Vec<Signature>, Box<dyn std::error::Error>> {
        // Signatures in reverse chronological order
        let mut sigs_reversed: Vec<Signature> = Vec::new(); // newest -> oldest during accumulation
        let mut before: Option<Signature> = None;

        loop {
            let sigs = self.get_signatures_for_address(after, before)?;

            // Add only valid signatures
            for s in &sigs {
                let ok_err = matches!(s.err, Some(serde_json::Value::Null) | None);
                if ok_err && s.block_time.is_some() {
                    sigs_reversed.push(s.signature);
                }
            }

            // If not requiring history, just use what we got in the first batch
            if !self.requires_history {
                break;
            }

            // If we got fewer signatures than requested, we've reached the end
            if sigs.len() < BATCH_SIZE {
                break;
            }

            // Set the 'before' option to the last signature for the next batch
            if let Some(last) = sigs.last() {
                before = Some(last.signature); // exclusive
            } else {
                break;
            }
        }

        // Convert to chronological order (oldest -> newest)
        sigs_reversed.reverse();
        Ok(sigs_reversed)
    }

    // Returns signatures in reverse chronological order
    fn get_signatures_for_address(
        &self,
        until: Option<Signature>,
        before: Option<Signature>,
    ) -> Result<Vec<SignatureInfo>, Box<dyn std::error::Error>> {
        let mut cfg = json!({
            "commitment": "confirmed",
            "limit": BATCH_SIZE
        });
        if let Some(u) = until {
            cfg["until"] = json!(u);
        }
        if let Some(b) = before {
            cfg["before"] = json!(b);
        }

        let params = json!([&self.program_id, cfg]);

        let req = JsonRpcRequest {
            jsonrpc: "2.0",
            id: json!(1),
            method: "getSignaturesForAddress",
            params,
        };

        let resp = self.agent.post(&self.rpc_url).send_json(&req)?;
        if resp.status() != 200 {
            return Err(format!(
                "HTTP {}: {}",
                resp.status(),
                resp.into_body().read_to_string()?
            )
            .into());
        }

        let resp: JsonRpcResponse<Vec<SignatureInfo>> = resp.into_body().read_json()?;
        if let Some(err) = resp.error {
            return Err(format!("RPC error (code {}): {}", err.code, err.message).into());
        }
        let result = resp.result.ok_or("Missing result in RPC response")?;
        Ok(result)
    }
}
