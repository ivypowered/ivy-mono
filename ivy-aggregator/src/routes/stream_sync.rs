use crate::routes::types::{error, AppError};
use crate::state::State;
use crate::types::chart::Candle;
use crate::types::charts::ChartKind;
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

#[derive(Serialize)]
struct SyncInitialContextEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    candles: Vec<Candle>,
    comments: Vec<crate::state::types::Comment>,
    sol_reserves: u64,
    token_reserves: u64,
    is_migrated: bool,
    pswap_pool: Option<Public>,
    mkt_cap_usd: f32,
    change_pct_24h: f32,
    sol_price: f32,
}

#[derive(Serialize)]
struct SyncUpdateEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    sol_reserves: u64,
    token_reserves: u64,
    mkt_cap_usd: f32,
    change_pct_24h: f32,
    is_migrated: bool,
    pswap_pool: Option<Public>,
    sol_price: f32,
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

// Add query params for sync stream
#[derive(Deserialize)]
pub struct SyncStreamParams {
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

pub async fn stream_sync(
    AxumState(state): AxumState<Arc<State>>,
    Path(address): Path<Public>,
    Query(params): Query<SyncStreamParams>,
) -> Result<Sse<impl Stream<Item = Result<SseEvent, axum::Error>>>, AppError> {
    // Get initial data and subscribe to updates
    let (initial_data, sync_rx, chart_rx, comment_rx, sol_price_rx) = {
        let mut data = state.write().unwrap();

        // Check if sync exists and get initial data
        let sync = data
            .syncs
            .get_sync_by_address(&address)
            .ok_or_else(|| error("Sync not found", StatusCode::NOT_FOUND))?;

        // Get initial chart data
        let candles = data
            .syncs
            .query_sync_chart(address, params.chart, params.chart_count, 0);

        // Get initial comments
        let (_, comments) = data.comments.get_comment_info(
            address,
            params.comment_count,
            0,
            true, // reverse to get most recent
        );

        // Subscribe to sync updates
        let sync_rx = data.syncs.subscribe_to_sync(&address).ok_or_else(|| {
            error(
                "Failed to subscribe to sync updates",
                StatusCode::INTERNAL_SERVER_ERROR,
            )
        })?;

        // Subscribe to chart updates
        let chart_rx = data
            .syncs
            .subscribe_to_sync_chart(&address, params.chart)
            .ok_or_else(|| {
                error(
                    "Failed to subscribe to sync chart",
                    StatusCode::INTERNAL_SERVER_ERROR,
                )
            })?;

        // Subscribe to comments
        let comment_rx = data.comments.subscribe(&address);

        // Subscribe to SOL price updates
        let sol_price_rx = data.prices.subscribe_sol();

        // Get current SOL price
        let sol_price = data.prices.sol();

        // Get bonding curve reserves
        let (sol_reserves, token_reserves) = (sync.sol_reserves, sync.token_reserves);

        // Calculate 24h change (this might need to come from charts)
        let change_pct_24h = 0.0; // You may want to get this from the charts component

        let initial = SyncInitialContextEvent {
            event_type: "initial",
            candles,
            comments,
            sol_reserves,
            token_reserves,
            is_migrated: sync.is_migrated,
            pswap_pool: sync.pswap_pool,
            mkt_cap_usd: sync.mkt_cap_usd,
            change_pct_24h,
            sol_price,
        };

        (initial, sync_rx, chart_rx, comment_rx, sol_price_rx)
    };

    // Create the SSE stream
    let stream = async_stream::stream! {
        // Send initial context
        yield Ok(SseEvent::default()
            .event("context")
            .data(serde_json::to_string(&initial_data).unwrap()));

        // Convert receivers to streams
        let mut sync_stream = BroadcastStream::new(sync_rx);
        let mut chart_stream = BroadcastStream::new(chart_rx);
        let mut comment_stream = BroadcastStream::new(comment_rx);
        let mut sol_price_rx = sol_price_rx;

        // Cache the latest sync data for when we need to send SOL price updates
        let mut cached_sync = SyncUpdateEvent {
            event_type: "sync",
            sol_reserves: initial_data.sol_reserves,
            token_reserves: initial_data.token_reserves,
            mkt_cap_usd: initial_data.mkt_cap_usd,
            change_pct_24h: initial_data.change_pct_24h,
            is_migrated: initial_data.is_migrated,
            pswap_pool: initial_data.pswap_pool,
            sol_price: initial_data.sol_price,
        };

        loop {
            tokio::select! {
                // Sync updates (reserves, market cap, etc.)
                Some(result) = sync_stream.next() => {
                    match result {
                        Ok(sync_update) => {
                            // Update cache
                            cached_sync.sol_reserves = sync_update.sol_reserves;
                            cached_sync.token_reserves = sync_update.token_reserves;
                            cached_sync.mkt_cap_usd = sync_update.mkt_cap_usd;
                            cached_sync.change_pct_24h = sync_update.change_pct_24h;
                            cached_sync.is_migrated = sync_update.is_migrated;
                            cached_sync.pswap_pool = sync_update.pswap_pool;

                            // Send update with current SOL price
                            let event_data = SyncUpdateEvent {
                                event_type: "sync",
                                sol_reserves: sync_update.sol_reserves,
                                token_reserves: sync_update.token_reserves,
                                mkt_cap_usd: sync_update.mkt_cap_usd,
                                change_pct_24h: sync_update.change_pct_24h,
                                is_migrated: sync_update.is_migrated,
                                pswap_pool: sync_update.pswap_pool,
                                sol_price: cached_sync.sol_price,
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

                // SOL price updates
                Ok(()) = sol_price_rx.changed() => {
                    let new_sol_price = *sol_price_rx.borrow();
                    if new_sol_price != cached_sync.sol_price {
                        // Update cached SOL price
                        cached_sync.sol_price = new_sol_price;

                        // Send update with new SOL price and cached sync data
                        yield Ok(SseEvent::default()
                            .event("update")
                            .data(serde_json::to_string(&cached_sync).unwrap()));
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
