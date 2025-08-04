mod chart;
mod charts;
mod event;
mod game;
mod jsonl;
mod leaderboard;
mod public;
mod quote;
mod signature;
mod sqrt_curve;
mod state;
mod util;
mod vendor;
mod volume;

use crate::charts::ChartKind;
use crate::public::Public;
use crate::state::State;
use rouille::{router, Request, Response};
use serde::Serialize;
use std::{
    str::FromStr,
    sync::Arc,
    time::{Duration, Instant},
};

// Listen address
const LISTEN_ADDRESS: &'static str = "0.0.0.0:5000";
// Minimum amount of time between state updates
// The number of RPC requests made over time is bounded by this value.
const STATE_UPDATE_INTERVAL: Duration = Duration::from_secs(3);

// Response wrappers for consistent API formatting
#[derive(Serialize)]
struct ApiResponse<T> {
    status: String,
    data: T,
}

#[derive(Serialize)]
struct ErrorResponse {
    status: String,
    msg: String,
}

fn success<T: Serialize>(data: T) -> rouille::Response {
    let response = ApiResponse {
        status: "ok".to_string(),
        data,
    };

    rouille::Response::json(&response)
}

fn error(message: &str, status_code: u16) -> rouille::Response {
    let response = ErrorResponse {
        status: "err".to_string(),
        msg: message.to_string(),
    };

    rouille::Response::json(&response).with_status_code(status_code)
}

// Helper to parse query parameters with default values
fn get_query_param_parsed<T: std::str::FromStr>(req: &Request, param_name: &str, default: T) -> T {
    req.get_param(param_name)
        .and_then(|v| v.parse::<T>().ok())
        .unwrap_or(default)
}

// Decode a hex string as a [u8; 32]
fn parse_hex_as_32_bytes(s: &str) -> Result<[u8; 32], &'static str> {
    match hex::decode(&s) {
        Ok(bytes) => {
            if bytes.len() != 32 {
                return Err("Provided string must be 32 bytes (64 hex chars)");
            }
            let mut result = [0u8; 32];
            result.copy_from_slice(&bytes);
            return Ok(result);
        }
        Err(_) => return Err("Invalid hex characters in provided string"),
    };
}

// --- Main Function ---

fn main() {
    // Initialize state
    let api_url = std::env::var("API_URL").unwrap_or_else(|_| "http://127.0.0.1:4000".to_string());
    let state_path =
        std::env::var("STATE_PATH").unwrap_or_else(|_| "priv/events.jsonl".to_string());
    let state = match State::new(&api_url, &state_path) {
        Ok(state) => Arc::new(state),
        Err(err) => {
            eprintln!("Failed to initialize state: {}", err);
            return;
        }
    };

    // Start a background thread to periodically update state
    let update_state = state.clone();
    std::thread::spawn(move || loop {
        let start_instant = Instant::now();
        if let Err(err) = update_state.update() {
            eprintln!("error updating state: {}", err);
        }
        let desired_elapsed = STATE_UPDATE_INTERVAL;
        let actual_elapsed = start_instant.elapsed();
        let sleep_duration = desired_elapsed.saturating_sub(actual_elapsed);
        if !sleep_duration.is_zero() {
            std::thread::sleep(sleep_duration);
        }
    });

    println!("Now listening on {}", LISTEN_ADDRESS);
    rouille::start_server(LISTEN_ADDRESS, move |req| {
        router!(req,
            // API Root
            (GET) (/) => {
                Response::text("Ivy Aggregator API").with_status_code(200)
            },

            // === GAME ROUTES ===

            // List games with optional filtering and pagination
            (GET) (/games) => {
                let count: usize = get_query_param_parsed(req, "count", 20);
                let skip: usize = get_query_param_parsed(req, "skip", 0);
                let sort: String = req.get_param("sort").unwrap_or_else(|| "new".to_string());
                let search_query: Option<String> = req.get_param("q");

                let games = match sort.as_str() {
                    "new" => {
                        if let Some(q) = search_query {
                            state.search_recent_games_by_name(q, count, skip)
                        } else {
                            state.get_recent_games(count, skip)
                        }
                    },
                    "top" => {
                        if let Some(q) = search_query {
                            state.search_top_games_by_name(q, count, skip)
                        } else {
                            state.get_top_games(count, skip)
                        }
                    },
                    "hot" => {
                        // Note: Hot games endpoint typically doesn't support search in this context
                        if search_query.is_some() {
                             return error("Search ('q') is not supported for 'hot' sort", 400);
                        }
                        state.get_hot_games(count, skip)
                    },
                    _ => return error("Invalid sort parameter. Use 'new', 'top', or 'hot'", 400)
                };

                success(games)
            },

            // Get total number of games
            (GET) (/games/count) => {
                let count = state.get_game_count();
                success(count)
            },

            // Get a specific game by address
            (GET) (/games/{address: Public}) => {
                match state.get_game_by_address(&address) {
                    Some(game) => success(game),
                    None => error("Game not found", 404)
                }
            },

            // Get the volume leaderboard for a given game
            (GET) (/games/{address: Public}/volume_board) => {
                let count: usize = get_query_param_parsed(req, "count", 20);
                let skip: usize = get_query_param_parsed(req, "skip", 0);
                success(state.query_volume_lb(address, count, skip))
            },

            // Get the PnL leaderboard for a given game
            (GET) (/games/{address: Public}/pnl_board) => {
                let count: usize = get_query_param_parsed(req, "count", 20);
                let skip: usize = get_query_param_parsed(req, "skip", 0);
                success(state.query_pnl_lb(address, count, skip))
            },

            // Get the PnL leaderboard for a given game
            (GET) (/games/{address: Public}/pnl/{user: Public}) => {
                success(state.get_pnl(address, user))
            },

            // === VOLUME ROUTES ===

            // Get global volume score for a single user
            (GET) (/volume/{user: Public}) => {
                let score = state.get_volume(user);
                success(score)
            },

            // Get global volume scores for multiple users (POST)
            (POST) (/volume/multiple) => {
                #[derive(serde::Deserialize)]
                struct VolumeMultipleRequest {
                    users: Vec<Public>,
                }

                let request: VolumeMultipleRequest = match rouille::input::json_input(req) {
                    Ok(req) => req,
                    Err(_) => return error("Invalid JSON body. Expected: { \"users\": [\"...\", ...] }", 400)
                };

                if request.users.is_empty() {
                    return error("Users array cannot be empty", 400);
                }

                if request.users.len() > 100 {
                    return error("Cannot query more than 100 users at once", 400);
                }

                let scores = state.get_volume_multiple(&request.users);
                success(scores)
            },

            // === COMMENT ROUTES ===

            // Get comments in either chronological order or `reverse` chronological order
            (GET) (/comments/{game: Public}) => {
                let count: usize = get_query_param_parsed(req, "count", 20);
                let skip: usize = get_query_param_parsed(req, "skip", 0);
                let reverse: bool = get_query_param_parsed(req, "reverse", false);
                let response = state.query_comments(game, count, skip, reverse);
                success(response)
            },

            // === CHART ROUTES ===

            // Get chart data for a specific game
            (GET) (/games/{game: Public}/charts/{kind: ChartKind}) => {
                let count: usize = get_query_param_parsed(req, "count", 100);
                let after_inclusive: u64 = get_query_param_parsed(req, "after_inclusive", 0);

                let response = state.query_game_chart(game, kind, count, after_inclusive);
                success(response)
            },

            // Get ivy token chart data
            (GET) (/ivy/charts/{kind: ChartKind}) => {
                let count: usize = get_query_param_parsed(req, "count", 100);
                let after_inclusive: u64 = get_query_param_parsed(req, "after_inclusive", 0);

                let response = state.query_ivy_chart(kind, count, after_inclusive);
                success(response)
            },

            // === PRICE / SWAP ESTIMATION ROUTES ===

            // Get current ivy token price
            (GET) (/ivy/price) => {
                let price = state.get_ivy_price();
                success(price)
            },

            // Get a game quote
            (GET) (/games/{game: Public}/quote) => {
                let input_amount = match req.get_param("input_amount")
                    .and_then(|v| v.parse::<u64>().ok()) {
                    Some(amount) => amount,
                    None => return error("Missing or invalid input_amount parameter (u64 expected)", 400)
                };

                let is_buy = match req.get_param("is_buy")
                    .and_then(|v| v.parse::<bool>().ok()) {
                    Some(is_buy) => is_buy,
                    None => return error("Missing or invalid is_buy parameter (bool expected)", 400)
                };

                match state.get_game_quote(game, input_amount, is_buy) {
                    Ok(quote) => success(quote),
                    Err(msg) => error(msg, 400) // Keep 400 as it's likely bad input or state
                }
            },

            // Get a quote for buying IVY
            (GET) (/ivy/quote) => {
                 let input_amount = match req.get_param("input_amount")
                    .and_then(|v| v.parse::<u64>().ok()) {
                    Some(amount) => amount,
                    None => return error("Missing or invalid input_amount parameter (u64 expected)", 400)
                };

                let is_buy = match req.get_param("is_buy")
                    .and_then(|v| v.parse::<bool>().ok()) {
                    Some(is_buy) => is_buy,
                    None => return error("Missing or invalid is_buy parameter (bool expected)", 400)
                };

                match state.get_world_quote(input_amount, is_buy) {
                    Ok(quote) => success(quote),
                    Err(msg) => error(msg, 400) // Keep 400 as it's likely bad input or state
                }
            },

            // === DEPOSIT ROUTE ===

            // Get burn info
            (GET) (/games/{game: Public}/burns/{id: String}) => {
                // Parse burn ID from path (already captured as String by router)
                let burn_id = match parse_hex_as_32_bytes(&id) {
                    Ok(v) => v,
                    Err(e) => return error(e, 400),
                };

                let burn_info = state.get_burn_info(game, burn_id);
                success(burn_info)
            },

            // Get deposit info
            (GET) (/games/{game: Public}/deposits/{id: String}) => {
                // Parse deposit ID from path (already captured as String by router)
                let deposit_id = match parse_hex_as_32_bytes(&id) {
                    Ok(v) => v,
                    Err(e) => return error(e, 400),
                };

                let deposit_info = state.get_deposit_info(game, deposit_id);
                success(deposit_info)
            },

            // Get withdraw info
            (GET) (/games/{game: Public}/withdrawals/{id: String}) => {
                // Parse withdraw ID from path (already captured as String by router)
                let withdraw_id = match parse_hex_as_32_bytes(&id) {
                    Ok(v) => v,
                    Err(e) => return error(e, 400),
                };

                let withdraw_info = state.get_withdraw_info(game, withdraw_id);
                success(withdraw_info)
            },

            // === INFO ROUTES ===

            // Get info for IVY
            (GET) (/ivy/info) => {
                success(state.get_ivy_info())
            },

            // Get global info
            (GET) (/global-info) => {
                success(state.get_global_info())
            },

            // === MISC ROUTES ===

            // Validate if string is a valid address
            (GET) (/validate/address/{address: String}) => {
                let is_valid = Public::from_str(&address).is_ok();
                success(is_valid)
            },

            // Fallback for 404
            _ => error("Resource not found", 404)
        )
    });
}
