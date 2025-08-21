use crate::routes::types::{success, ApiResponse};
use crate::state::State;
use axum::{extract::State as AxumState, response::Json};
use std::sync::Arc;

// Handler functions
pub async fn ivy_price(AxumState(state): AxumState<Arc<State>>) -> Json<ApiResponse<f32>> {
    let data = state.read().unwrap();
    success(data.world.price())
}
