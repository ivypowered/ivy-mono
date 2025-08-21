use crate::routes::types::{success, ApiResponse};
use crate::types::public::Public;
use axum::{extract::Path, response::Json};
use std::str::FromStr;

// Handler functions
pub async fn validate_address(Path(address): Path<String>) -> Json<ApiResponse<bool>> {
    let is_valid = Public::from_str(&address).is_ok();
    success(is_valid)
}

pub async fn root() -> &'static str {
    "Ivy Aggregator API"
}
