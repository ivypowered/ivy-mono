use crate::routes::types::{error, success, ApiResult};
use crate::state::State;
use crate::types::public::Public;
use crate::types::sync::Sync;
use axum::extract::{Path, State as AxumState};
use axum::http::StatusCode;
use serde::Serialize;
use std::sync::Arc;

// Response types
#[derive(Serialize)]
pub struct SyncWithPrice {
    #[serde(flatten)]
    pub sync: Sync,
    pub last_price_usd: f32,
}

// Handler functions

/// Get a specific sync by address
pub async fn get_sync(
    AxumState(state): AxumState<Arc<State>>,
    Path(address): Path<Public>,
) -> ApiResult<Sync> {
    let data = state.read().unwrap();
    match data.syncs.get_sync_by_address(&address) {
        Some(sync) => Ok(success(sync)),
        None => Err(error("Sync not found", StatusCode::NOT_FOUND)),
    }
}
