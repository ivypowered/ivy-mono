use crate::routes::types::{error, success, ApiResponse, ApiResult};
use crate::state::types::PnlResponse;
use crate::state::State;
use crate::types::asset::Asset;
use crate::types::game::Game;
use crate::types::public::Public;
use crate::types::sync::Sync;
use axum::http::StatusCode;
use axum::{
    extract::{Path, Query, State as AxumState},
    response::Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

// Query parameter structs
// Query parameter structs
#[derive(Deserialize)]
pub struct AssetsQueryParams {
    #[serde(default = "default_count")]
    count: usize,
    #[serde(default)]
    skip: usize,
    #[serde(default = "default_sort")]
    sort: String,
    q: Option<String>,
}

#[derive(Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_count")]
    count: usize,
    #[serde(default)]
    skip: usize,
}

#[derive(Deserialize)]
pub struct PnlBoardParams {
    #[serde(default = "default_count")]
    count: usize,
    #[serde(default)]
    skip: usize,
    #[serde(default)]
    realized: bool,
}

fn default_count() -> usize {
    20
}

fn default_sort() -> String {
    "new".to_string()
}

// Handler functions
pub async fn list_assets(
    AxumState(state): AxumState<Arc<State>>,
    Query(params): Query<AssetsQueryParams>,
) -> ApiResult<Vec<Asset>> {
    let data = state.read().unwrap();

    let assets = match params.sort.as_str() {
        "new" | "recent" => {
            if let Some(q) = params.q {
                data.assets.search_recent_assets_by_name(
                    &data.games,
                    &data.syncs,
                    &q,
                    params.count,
                    params.skip,
                )
            } else {
                data.assets
                    .get_recent_assets(&data.games, &data.syncs, params.count, params.skip)
            }
        }
        "top" => {
            if let Some(q) = params.q {
                data.assets.search_top_assets_by_name(
                    &data.games,
                    &data.syncs,
                    &q,
                    params.count,
                    params.skip,
                )
            } else {
                data.assets
                    .get_top_assets(&data.games, &data.syncs, params.count, params.skip)
            }
        }
        "hot" | "trending" => {
            if params.q.is_some() {
                return Err(error(
                    "Search ('q') is not supported for 'hot' sort",
                    StatusCode::BAD_REQUEST,
                ));
            }
            data.assets
                .get_hot_assets(&data.games, &data.syncs, params.count, params.skip)
        }
        _ => {
            return Err(error(
                "Invalid sort parameter. Use 'new', 'top', or 'hot'",
                StatusCode::BAD_REQUEST,
            ))
        }
    };

    Ok(success(assets))
}

pub async fn assets_count(AxumState(state): AxumState<Arc<State>>) -> Json<ApiResponse<usize>> {
    let data = state.read().unwrap();
    success(data.assets.get_asset_count(&data.games, &data.syncs))
}

/// Get volume leaderboard for a specific asset (game or sync)
pub async fn volume_board(
    AxumState(state): AxumState<Arc<State>>,
    Path(address): Path<Public>,
    Query(params): Query<PaginationParams>,
) -> Json<ApiResponse<Vec<crate::state::types::VlbEntry>>> {
    let data = state.read().unwrap();
    success(
        data.volume
            .query_volume_lb(address, params.count, params.skip),
    )
}

/// Get PnL leaderboard for a specific asset (game or sync)
pub async fn pnl_board(
    AxumState(state): AxumState<Arc<State>>,
    Path(address): Path<Public>,
    Query(params): Query<PnlBoardParams>,
) -> Json<ApiResponse<Vec<crate::state::types::PnlEntry>>> {
    let data = state.read().unwrap();
    let price = data.games.last_price_for(&address);
    success(
        data.pnl
            .query_pnl_lb(address, price, params.count, params.skip, params.realized),
    )
}

/// Get PnL for a specific user in a specific asset (game or sync)
pub async fn get_pnl(
    AxumState(state): AxumState<Arc<State>>,
    Path((address, user)): Path<(Public, Public)>,
) -> Json<ApiResponse<PnlResponse>> {
    let data = state.read().unwrap();
    let price = data.games.last_price_for(&address);
    success(data.pnl.get_pnl(address, user, price))
}

#[derive(Serialize)]
#[serde(tag = "kind", content = "asset")]
pub enum AssetResponse {
    #[serde(rename = "game")]
    Game(Game),
    #[serde(rename = "sync")]
    Sync(Sync),
}

// Add this new handler function
pub async fn get_asset(
    AxumState(state): AxumState<Arc<State>>,
    Path(address): Path<Public>,
) -> ApiResult<AssetResponse> {
    let data = state.read().unwrap();

    // First check if it's a game
    if let Some(game) = data.games.get_game_by_address(&address) {
        return Ok(success(AssetResponse::Game(game)));
    }

    // Then check if it's a sync
    if let Some(sync) = data.syncs.get_sync_by_address(&address) {
        return Ok(success(AssetResponse::Sync(sync)));
    }

    // Not found
    Err(error(
        &format!("Asset with address {} not found", address),
        StatusCode::NOT_FOUND,
    ))
}
