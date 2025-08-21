use crate::routes::types::{error, success, ApiResult};
use crate::state::State;
use crate::types::game::Game;
use crate::types::public::Public;
use axum::extract::{Path, State as AxumState};
use axum::http::StatusCode;
use std::sync::Arc;

// Helper function to decode a hex string as a [u8; 32]
fn parse_hex_as_32_bytes(s: &str) -> Result<[u8; 32], &'static str> {
    match hex::decode(s) {
        Ok(bytes) => {
            if bytes.len() != 32 {
                return Err("Provided string must be 32 bytes (64 hex chars)");
            }
            let mut result = [0u8; 32];
            result.copy_from_slice(&bytes);
            Ok(result)
        }
        Err(_) => Err("Invalid hex characters in provided string"),
    }
}

// Handler functions

/// Get a specific game by address
pub async fn get_game(
    AxumState(state): AxumState<Arc<State>>,
    Path(address): Path<Public>,
) -> ApiResult<Game> {
    let data = state.read().unwrap();
    match data.games.get_game_by_address(&address) {
        Some(game) => Ok(success(game)),
        None => Err(error("Game not found", StatusCode::NOT_FOUND)),
    }
}

/// Get burn receipt info
pub async fn get_burn_info(
    AxumState(state): AxumState<Arc<State>>,
    Path((game, id)): Path<(Public, String)>,
) -> ApiResult<Option<crate::state::types::BurnInfo>> {
    let burn_id = parse_hex_as_32_bytes(&id).map_err(|e| error(e, StatusCode::BAD_REQUEST))?;
    let data = state.read().unwrap();
    Ok(success(data.receipts.get_burn_info(game, burn_id)))
}

/// Get deposit receipt info
pub async fn get_deposit_info(
    AxumState(state): AxumState<Arc<State>>,
    Path((game, id)): Path<(Public, String)>,
) -> ApiResult<Option<crate::state::types::DepositInfo>> {
    let deposit_id = parse_hex_as_32_bytes(&id).map_err(|e| error(e, StatusCode::BAD_REQUEST))?;
    let data = state.read().unwrap();
    Ok(success(data.receipts.get_deposit_info(game, deposit_id)))
}

/// Get withdraw receipt info
pub async fn get_withdraw_info(
    AxumState(state): AxumState<Arc<State>>,
    Path((game, id)): Path<(Public, String)>,
) -> ApiResult<Option<crate::state::types::WithdrawInfo>> {
    let withdraw_id = parse_hex_as_32_bytes(&id).map_err(|e| error(e, StatusCode::BAD_REQUEST))?;
    let data = state.read().unwrap();
    Ok(success(data.receipts.get_withdraw_info(game, withdraw_id)))
}
