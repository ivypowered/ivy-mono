use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use serde::Serialize;

// Response wrappers for consistent API formatting
#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub status: String,
    pub data: T,
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub status: String,
    pub msg: String,
}

// Custom result type for API responses
pub type ApiResult<T> = Result<Json<ApiResponse<T>>, AppError>;

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
        (self.status_code, axum::response::Json(response)).into_response()
    }
}

pub fn success<T: Serialize>(data: T) -> Json<ApiResponse<T>> {
    Json(ApiResponse {
        status: "ok".to_string(),
        data,
    })
}

pub fn error(message: &str, status_code: StatusCode) -> AppError {
    AppError {
        status_code,
        message: message.to_string(),
    }
}
