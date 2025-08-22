use crate::routes::types::{success, ApiResponse};
use crate::state::types::CommentInfo;
use crate::state::State;
use crate::types::public::Public;
use axum::{
    extract::{Path, Query, State as AxumState},
    response::Json,
};
use serde::Deserialize;
use std::sync::Arc;

// Query parameter structs
#[derive(Deserialize)]
pub struct CommentsParams {
    #[serde(default = "default_count")]
    count: usize,
    #[serde(default)]
    skip: usize,
    #[serde(default)]
    reverse: bool,
}

fn default_count() -> usize {
    20
}

// Handler functions
pub async fn get_comments(
    AxumState(state): AxumState<Arc<State>>,
    Path(asset): Path<Public>, // Changed from 'game' to 'asset' for clarity
    Query(params): Query<CommentsParams>,
) -> Json<ApiResponse<CommentInfo>> {
    let data = state.read().unwrap();
    let (total, comments) = data
        .comments // Changed from data.games to data.comments
        .get_comment_info(asset, params.count, params.skip, params.reverse);

    success(CommentInfo { total, comments })
}
