use crate::state::State;
use crate::types::public::Public;
use axum::{
    extract::{Path, State as AxumState},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::routes::types::{success, ApiResponse};

#[derive(Serialize)]
struct ErrorResponse {
    status: String,
    msg: String,
}

// Custom result type for API responses
type ApiResult<T> = Result<Json<ApiResponse<T>>, AppError>;

// Custom error type that implements IntoResponse
pub struct AppError {
    pub status_code: StatusCode,
    pub message: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let response = ErrorResponse {
            status: "err".to_string(),
            msg: self.message,
        };
        (self.status_code, Json(response)).into_response()
    }
}

pub fn error(message: &str, status_code: StatusCode) -> AppError {
    AppError {
        status_code,
        message: message.to_string(),
    }
}

#[derive(Deserialize)]
pub struct VolumeMultipleRequest {
    users: Vec<Public>,
}

// Handler functions
pub async fn get_volume(
    AxumState(state): AxumState<Arc<State>>,
    Path(user): Path<Public>,
) -> Json<ApiResponse<f32>> {
    let data = state.read().unwrap();
    success(data.volume.get_volume(user))
}

pub async fn volume_multiple(
    AxumState(state): AxumState<Arc<State>>,
    Json(request): Json<VolumeMultipleRequest>,
) -> ApiResult<Vec<f32>> {
    if request.users.is_empty() {
        return Err(error(
            "Users array cannot be empty",
            StatusCode::BAD_REQUEST,
        ));
    }

    if request.users.len() > 100 {
        return Err(error(
            "Cannot query more than 100 users at once",
            StatusCode::BAD_REQUEST,
        ));
    }

    let data = state.read().unwrap();
    Ok(success(data.volume.get_volume_multiple(&request.users)))
}
