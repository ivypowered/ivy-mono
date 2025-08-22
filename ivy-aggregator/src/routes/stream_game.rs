use crate::routes::types::{error, AppError};
use crate::state::State;
use crate::types::chart::Candle;
use crate::types::charts::ChartKind;
use crate::types::event::serialize_u64_as_string;
use crate::types::public::Public;
use axum::response::sse::{Event as SseEvent, Sse};
use axum::{
    extract::{Path, Query, State as AxumState},
    http::StatusCode,
};
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt as _;

// SSE Event types for streaming
#[derive(Serialize)]
struct InitialContextEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    candles: Vec<Candle>,
    comments: Vec<crate::state::types::Comment>,
    #[serde(serialize_with = "serialize_u64_as_string")]
    game_balance: u64,
    #[serde(serialize_with = "serialize_u64_as_string")]
    ivy_balance: u64,
    #[serde(serialize_with = "serialize_u64_as_string")]
    ivy_sold: u64,
    #[serde(serialize_with = "serialize_u64_as_string")]
    ivy_curve_max: u64,
    curve_input_scale: f32,
    mkt_cap_usd: f32,
    change_pct_24h: f32,
    ivy_fee_bps: u8,
    game_fee_bps: u8,
}

#[derive(Serialize)]
struct BalanceUpdateEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    #[serde(serialize_with = "serialize_u64_as_string")]
    game_balance: u64,
    #[serde(serialize_with = "serialize_u64_as_string")]
    ivy_balance: u64,
    mkt_cap_usd: f32,
    change_pct_24h: f32,
}

#[derive(Serialize)]
struct CommentUpdateEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    comment: crate::state::types::Comment,
}

#[derive(Serialize)]
struct CandleUpdateEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    candle: Candle,
}

#[derive(Serialize)]
struct WorldUpdateEventSSE {
    #[serde(rename = "type")]
    event_type: &'static str,
    #[serde(serialize_with = "serialize_u64_as_string")]
    ivy_sold: u64,
}

// Query parameter structs
#[derive(Deserialize)]
pub struct StreamParams {
    chart: ChartKind,
    #[serde(default = "default_chart_count")]
    chart_count: usize,
    #[serde(default = "default_comment_count")]
    comment_count: usize,
}

fn default_chart_count() -> usize {
    100
}

fn default_comment_count() -> usize {
    20
}

// Handler functions
pub async fn stream_game(
    AxumState(state): AxumState<Arc<State>>,
    Path(address): Path<Public>,
    Query(params): Query<StreamParams>,
) -> Result<Sse<impl Stream<Item = Result<SseEvent, axum::Error>>>, AppError> {
    // Get initial data and subscribe to updates
    let (initial_data, balance_rx, comment_rx, chart_rx, world_rx) = {
        let mut data = state.write().unwrap();

        // Check if game exists
        if !data.games.get_game_by_address(&address).is_some() {
            return Err(error("Game not found", StatusCode::NOT_FOUND));
        }

        // Get initial chart data
        let (candles, mkt_cap_usd, change_pct_24h) =
            data.games
                .query_game_chart(address, params.chart, params.chart_count, 0);

        // Get initial comments
        let (_, comments) = data.comments.get_comment_info(
            address,
            params.comment_count,
            0,
            true, // reverse to get most recent
        );

        // Get game balances
        let (ivy_balance, game_balance) = data.games.reserves_for(&address).unwrap_or((0, 0));

        // Get world data
        let world_data = data.world.data();

        // Subscribe to updates
        let balance_rx = data
            .games
            .subscribe_to_game_balances(&address)
            .ok_or_else(|| {
                error(
                    "Failed to subscribe to game balances",
                    StatusCode::INTERNAL_SERVER_ERROR,
                )
            })?;

        let comment_rx = data.comments.subscribe(&address);

        let chart_rx = data
            .games
            .subscribe_to_game_chart(&address, params.chart)
            .ok_or_else(|| {
                error(
                    "Failed to subscribe to game chart",
                    StatusCode::INTERNAL_SERVER_ERROR,
                )
            })?;

        let world_rx = data.world.subscribe();

        let initial = InitialContextEvent {
            event_type: "initial",
            candles,
            comments,
            game_balance,
            ivy_balance,
            ivy_sold: world_data.ivy_sold,
            ivy_curve_max: world_data.ivy_curve_max,
            curve_input_scale: (world_data.curve_input_scale_num as f32)
                / (world_data.curve_input_scale_den as f32),
            mkt_cap_usd,
            change_pct_24h,
            ivy_fee_bps: world_data.ivy_fee_bps,
            game_fee_bps: world_data.game_fee_bps,
        };

        (initial, balance_rx, comment_rx, chart_rx, world_rx)
    };

    // Create the SSE stream
    let stream = async_stream::stream! {
        // Send initial context
        yield Ok(SseEvent::default()
            .event("context")
            .data(serde_json::to_string(&initial_data).unwrap()));

        // Convert receivers to streams
        let mut balance_stream = BroadcastStream::new(balance_rx);
        let mut comment_stream = BroadcastStream::new(comment_rx);
        let mut chart_stream = BroadcastStream::new(chart_rx);
        let mut world_stream = BroadcastStream::new(world_rx);

        loop {
            tokio::select! {
                // Game balance updates
                Some(result) = balance_stream.next() => {
                    match result {
                        Ok(balance_update) => {
                            let event_data = BalanceUpdateEvent {
                                event_type: "balance",
                                game_balance: balance_update.game_balance,
                                ivy_balance: balance_update.ivy_balance,
                                mkt_cap_usd: balance_update.mkt_cap_usd,
                                change_pct_24h: balance_update.change_pct_24h,
                            };
                            yield Ok(SseEvent::default()
                                .event("update")
                                .data(serde_json::to_string(&event_data).unwrap()));
                        }
                        Err(_) => {
                            // Lagged, but continue
                            continue;
                        }
                    }
                }

                // New comments
                Some(result) = comment_stream.next() => {
                    match result {
                        Ok(comment) => {
                            let event_data = CommentUpdateEvent {
                                event_type: "comment",
                                comment,
                            };
                            yield Ok(SseEvent::default()
                                .event("update")
                                .data(serde_json::to_string(&event_data).unwrap()));
                        }
                        Err(_) => {
                            continue;
                        }
                    }
                }

                // Chart updates
                Some(result) = chart_stream.next() => {
                    match result {
                        Ok(candle) => {
                            let event_data = CandleUpdateEvent {
                                event_type: "candle",
                                candle,
                            };
                            yield Ok(SseEvent::default()
                                .event("update")
                                .data(serde_json::to_string(&event_data).unwrap()));
                        }
                        Err(_) => {
                            continue;
                        }
                    }
                }

                // World updates
                Some(result) = world_stream.next() => {
                    match result {
                        Ok(world_update) => {
                            let event_data = WorldUpdateEventSSE {
                                event_type: "world",
                                ivy_sold: world_update.ivy_sold,
                            };
                            yield Ok(SseEvent::default()
                                .event("update")
                                .data(serde_json::to_string(&event_data).unwrap()));
                        }
                        Err(_) => {
                            continue;
                        }
                    }
                }

                else => {
                    // All streams closed
                    break;
                }
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(std::time::Duration::from_secs(30))
            .text("keep-alive"),
    ))
}
