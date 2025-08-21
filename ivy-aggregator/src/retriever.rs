use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::Read;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use crate::types::event::{Event, EventData};
use crate::types::public::Public;
use crate::types::signature::Signature;

const MAX_RESPONSE_LEN: u64 = 100_000_000;
const BATCH_SIZE: usize = 1000;
const RETRY_INTERVAL: Duration = Duration::from_millis(250);
const EVENT_IX_TAG: [u8; 8] = [0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d];

// Specific request for getTransaction batch
#[derive(Serialize)]
struct GetTransactionRequest {
    jsonrpc: &'static str,
    id: usize,
    method: &'static str,
    params: (Signature, TransactionOptions),
}

#[derive(Serialize, Clone, Copy)]
struct TransactionOptions {
    commitment: &'static str,
    encoding: &'static str,
    #[serde(rename = "maxSupportedTransactionVersion")]
    max_supported_transaction_version: u8,
}

#[derive(Deserialize)]
struct GetTransactionResponse {
    #[serde(default)]
    result: Option<TransactionResult>,
    #[serde(default)]
    error: Option<JsonRpcError>,
}

#[derive(Deserialize, Debug)]
struct JsonRpcError {
    code: i64,
    message: String,
}

#[derive(Deserialize, Debug)]
struct LoadedAddresses {
    writable: Vec<String>,
    readonly: Vec<String>,
}

#[derive(Deserialize, Debug)]
struct TransactionMeta {
    err: Option<Value>,
    #[serde(rename = "innerInstructions")]
    inner_instructions: Option<Vec<InnerInstruction>>,
    #[serde(rename = "loadedAddresses")]
    loaded_addresses: Option<LoadedAddresses>,
}

#[derive(Deserialize, Debug)]
struct InnerInstruction {
    instructions: Vec<Instruction>,
}

#[derive(Deserialize, Debug)]
struct Instruction {
    #[serde(rename = "programIdIndex")]
    program_id_index: u8,
    data: String,
}

#[derive(Deserialize, Debug)]
struct Transaction {
    message: Message,
}

#[derive(Deserialize, Debug)]
struct Message {
    #[serde(rename = "accountKeys")]
    account_keys: Vec<String>,
}

#[derive(Deserialize, Debug, Default)]
struct TransactionResult {
    meta: Option<TransactionMeta>,
    transaction: Option<Transaction>,
    #[serde(rename = "blockTime")]
    block_time: Option<u64>,
}

pub struct Retriever {
    rpc_url: String,
    rx: mpsc::Receiver<(Public, Vec<Signature>)>,
    tx: mpsc::Sender<Vec<Event>>,
}

impl Retriever {
    pub fn new(
        rpc_url: &str,
        rx: mpsc::Receiver<(Public, Vec<Signature>)>,
        tx: mpsc::Sender<Vec<Event>>,
    ) -> Self {
        Self {
            rpc_url: rpc_url.to_string(),
            rx,
            tx,
        }
    }

    pub fn run(self) {
        while let Ok((program_id, signatures)) = self.rx.recv() {
            // Build a unified batch of (program_id, signature) pairs
            let mut batch: Vec<(Public, Signature)> = signatures
                .into_iter()
                .map(|sig| (program_id, sig))
                .collect();

            // Drain backlog to maximize batch size
            while let Ok((prog_id, extra_sigs)) = self.rx.try_recv() {
                for sig in extra_sigs {
                    batch.push((prog_id, sig));
                }
            }

            if batch.is_empty() {
                continue;
            }

            // Process the batch
            let transactions = self.fetch_transactions_batch(&batch);

            // Extract events from all transactions
            let mut all_events = Vec::new();
            for ((program_id, signature), tx_result) in batch.into_iter().zip(transactions) {
                self.extract_events(&mut all_events, signature, tx_result, program_id);
            }

            if !all_events.is_empty() {
                _ = self.tx.send(all_events);
            }
        }
    }

    /// Fetch a batch of transactions from RPC
    fn fetch_transactions_batch(&self, batch: &[(Public, Signature)]) -> Vec<TransactionResult> {
        let mut all_results = Vec::with_capacity(batch.len());

        // Process in chunks to respect RPC batch size limits
        for chunk in batch.chunks(BATCH_SIZE) {
            let chunk_results = self.fetch_chunk_with_retry(chunk);
            all_results.extend(chunk_results);
        }

        all_results
    }

    /// Fetch a single chunk with retry logic
    fn fetch_chunk_with_retry(&self, chunk: &[(Public, Signature)]) -> Vec<TransactionResult> {
        loop {
            match self.fetch_transaction_chunk(chunk) {
                Ok(results) => {
                    return results;
                }
                Err(e) => {
                    eprintln!("Retriever: error fetching chunk: {}", e);
                }
            }
            thread::sleep(RETRY_INTERVAL);
        }
    }

    /// Fetch a single chunk of transactions
    fn fetch_transaction_chunk(
        &self,
        chunk: &[(Public, Signature)],
    ) -> Result<Vec<TransactionResult>, Box<dyn std::error::Error>> {
        let options = TransactionOptions {
            commitment: "confirmed",
            encoding: "json",
            max_supported_transaction_version: 0,
        };

        let requests: Vec<GetTransactionRequest> = chunk
            .iter()
            .enumerate()
            .map(|(i, (_, sig))| GetTransactionRequest {
                jsonrpc: "2.0",
                id: i,
                method: "getTransaction",
                params: (*sig, options),
            })
            .collect();

        let mut responses: Vec<GetTransactionResponse> = Vec::new();
        for _ in 0..10 {
            let resp = ureq::post(&self.rpc_url).send_json(&requests)?;
            if resp.status() != 200 {
                return Err(format!(
                    "HTTP {}: {}",
                    resp.status(),
                    resp.into_body().read_to_string()?
                )
                .into());
            }

            let reader = resp.into_body().into_reader().take(MAX_RESPONSE_LEN);
            responses = serde_json::from_reader(reader)?;

            if responses.is_empty() && !chunk.is_empty() {
                // This RPC endpoint does not support batching, let's retry immediately
                continue;
            }

            break;
        }
        if responses.is_empty() && !chunk.is_empty() {
            // We tried enough, it's not working
            return Err("Batch size too large for RPC server".into());
        }
        if responses.len() != chunk.len() {
            return Err(format!(
                "Chunk size mismatch (expected: {}, got: {})",
                chunk.len(),
                responses.len(),
            )
            .into());
        }

        let mut results = Vec::with_capacity(responses.len());
        for r in responses {
            if let Some(err) = r.error {
                return Err(format!(
                    "Error in getTransaction (code {}): {}",
                    err.code, err.message,
                )
                .into());
            }
            match r.result {
                Some(v) => results.push(v),
                None => {
                    return Err("No result provided in getTransaction".into());
                }
            }
        }

        Ok(results)
    }

    fn extract_events(
        &self,
        dst: &mut Vec<Event>,
        signature: Signature,
        tx_result: TransactionResult,
        program_id: Public,
    ) {
        let (transaction, mut meta, timestamp) =
            match (tx_result.transaction, tx_result.meta, tx_result.block_time) {
                (Some(t), Some(m), Some(p)) => (t, m, p),
                _ => return,
            };

        // Skip failed transactions
        match meta.err {
            None | Some(Value::Null) => {}
            _ => return,
        }

        // Build full account list
        let (writable, readonly) = meta
            .loaded_addresses
            .take()
            .map(|x| (x.writable, x.readonly))
            .unwrap_or_default();

        let program_id_str = program_id.to_string();
        let pr_index = transaction
            .message
            .account_keys
            .iter()
            .chain(writable.iter())
            .chain(readonly.iter())
            .position(|key| key == &program_id_str)
            .map(|x| x as u8);

        let pr_index = match pr_index {
            Some(x) => x,
            None => return,
        };

        let inner = match meta.inner_instructions {
            Some(v) => v,
            None => return,
        };

        // Extract matching instructions
        for cpi in inner {
            for ins in cpi.instructions {
                if ins.program_id_index != pr_index {
                    continue;
                }

                let data = match bs58::decode(&ins.data).into_vec() {
                    Ok(d) => d,
                    Err(_) => continue,
                };

                // Filter out non-events
                if !data.starts_with(&EVENT_IX_TAG) {
                    continue;
                }

                // Try to parse
                let data = match EventData::from_bytes(&data[8..]) {
                    Ok(Some(x)) => x,
                    Ok(None) => {
                        // Not a matching event (i.e. one we care about)
                        continue;
                    }
                    Err(e) => {
                        // we want to know about this
                        eprintln!("Retriever: can't deserialize event: {}", e);
                        continue;
                    }
                };

                // Output event
                dst.push(Event {
                    data,
                    signature,
                    timestamp,
                });
            }
        }
    }
}
