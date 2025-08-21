use crate::routes::types::{success, ApiResponse};
use crate::state::types::{GlobalInfo, IvyInfo};
use crate::state::State;
use crate::util::from_ivy_amount;
use axum::{extract::State as AxumState, response::Json};
use std::sync::Arc;

// Handler functions
pub async fn ivy_info(AxumState(state): AxumState<Arc<State>>) -> Json<ApiResponse<IvyInfo>> {
    let data = state.read().unwrap();
    let world_data = data.world.data();

    success(IvyInfo {
        create_timestamp: world_data.create_timestamp,
        ivy_initial_liquidity: from_ivy_amount(world_data.ivy_initial_liquidity),
        game_initial_liquidity: from_ivy_amount(world_data.game_initial_liquidity),
        ivy_price: data.world.price(),
        ivy_mkt_cap: from_ivy_amount(world_data.ivy_curve_max) * data.world.price(),
        ivy_change_24h: data.world.ivy_change_24h(),
    })
}

pub async fn global_info(AxumState(state): AxumState<Arc<State>>) -> Json<ApiResponse<GlobalInfo>> {
    let data = state.read().unwrap();

    success(GlobalInfo {
        games_listed: data.games.get_game_count() as u64,
        tvl: from_ivy_amount(data.games.tvl_raw_ivy()) * data.world.price(),
        volume_24h: data.volume.volume_24h_usd(),
        featured_assets: data.assets.get_featured_assets(&data.games, &data.syncs),
    })
}
