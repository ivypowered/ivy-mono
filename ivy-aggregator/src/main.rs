mod applier;
mod pf;
mod pricer;
mod retriever;
mod routes;
mod scanner;
mod server;
mod sqrt_curve;
mod state;
mod types;
mod util;
mod volume;

use crate::applier::Applier;
use crate::pricer::Pricer;
use crate::retriever::Retriever;
use crate::scanner::Scanner;
use crate::server::Server;
use crate::state::StateData;
use crate::types::public::Public;
use std::net::SocketAddr;
use std::process::exit;
use std::sync::{mpsc, RwLock};
use std::thread;
use std::{str::FromStr, sync::Arc, time::Duration};
use ureq::Agent;

// Hot list update interval
const HOT_LIST_UPDATE_INTERVAL: Duration = Duration::from_secs(10);

#[tokio::main]
async fn main() {
    // Get env variables
    let rpc_url = std::env::var("RPC_URL").unwrap_or_else(|_| "http://127.0.0.1:8899".to_string());
    let ivy_program_id_str = std::env::var("PROGRAM_ID")
        .unwrap_or_else(|_| "DkGdbW8SJmUoVE9KaBRwrvsQVhcuidy47DimjrhSoySE".to_string());
    let ivy_program_id = match Public::from_str(&ivy_program_id_str) {
        Ok(x) => x,
        Err(err) => {
            eprintln!("Can't parse IVY program ID: {}", err);
            exit(1);
        }
    };
    let listen_addr: SocketAddr = match std::env::var("LISTEN_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:5000".to_string())
        .parse()
    {
        Ok(x) => x,
        Err(err) => {
            eprintln!("Can't parse listen address: {}", err);
            exit(1);
        }
    };
    let api_url = std::env::var("API_URL").unwrap_or_else(|_| "http://127.0.0.1:4000".to_string());

    // Get Pump.fun and Pump.fun AMM program IDs from pf.rs
    let pf_program_id = crate::pf::PF_PROGRAM;
    let pa_program_id = crate::pf::PA_PROGRAM;

    // Create state
    let state = Arc::new(RwLock::new(StateData::new()));

    // Create channels for the data pipeline
    let (scanner_tx, scanner_rx) = mpsc::channel();
    let (retriever_tx, retriever_rx) = mpsc::channel();

    // Create applier first
    let applier = Applier::new(
        state.clone(),
        retriever_rx,
        "./priv/events.jsonl",
        "./priv/ivy_cursor.json",
        "./priv/pf_cursor.json",
        "./priv/pa_cursor.json",
        "./priv/fx_last_price.json",
    )
    .expect("Failed to create applier");

    // Get last signatures from applier
    let ivy_last_signature = applier.get_ivy_last_signature().cloned();
    let pf_last_signature = applier.get_pf_last_signature().cloned();
    let pa_last_signature = applier.get_pa_last_signature().cloned();

    // Start applier in a separate thread
    thread::spawn(move || {
        applier.run();
    });

    let agent = Agent::new_with_defaults();

    let ivy_scanner = Scanner::new(
        &rpc_url,
        ivy_program_id,
        scanner_tx.clone(),
        agent.clone(),
        ivy_last_signature,
    );

    let pf_scanner = Scanner::new(
        &rpc_url,
        pf_program_id,
        scanner_tx.clone(),
        agent.clone(),
        pf_last_signature,
    );

    let pa_scanner = Scanner::new(
        &rpc_url,
        pa_program_id,
        scanner_tx.clone(),
        agent.clone(),
        pa_last_signature,
    );

    // Run scanners in separate threads
    thread::spawn(move || {
        ivy_scanner.run();
    });

    thread::spawn(move || {
        pf_scanner.run();
    });

    thread::spawn(move || {
        pa_scanner.run();
    });

    // Create and start retriever
    let retriever = Retriever::new(&rpc_url, scanner_rx, retriever_tx.clone());
    thread::spawn(move || {
        retriever.run();
    });

    // Spawn the hot list update task
    let state_clone = state.clone();
    thread::spawn(move || loop {
        thread::sleep(HOT_LIST_UPDATE_INTERVAL);
        // 1. Acquire read lock and get readonly reference to game list
        let hot_list = {
            let sr = state_clone.read().unwrap();
            sr.assets.calculate_hot_list(&sr.games, &sr.syncs)
        };
        // 2. Acquire write lock and update the hot game list
        let mut sw = state_clone.write().unwrap();
        sw.assets.update_hot_list(hot_list);
    });

    // Create and start the SOL price fetcher
    let pricer = Pricer::new(api_url, retriever_tx);
    thread::spawn(move || {
        pricer.run();
    });

    // Create and start the HTTP server
    let server = Server::new(listen_addr, state);
    if let Err(e) = server.run().await {
        eprintln!("Server error: {}", e);
        exit(1);
    };
}
