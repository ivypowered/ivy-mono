use crate::routes::types::{error, AppError};
use crate::state::State;
use crate::types::chart::Candle;
use crate::types::charts::ChartKind;
use crate::types::event::serialize_u64_as_string;
use crate::types::public::Public;
use crate::util::from_ivy_amount;
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

#[derive(Serialize)]
struct IvyInitialContextEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    candles: Vec<Candle>,
    #[serde(serialize_with = "serialize_u64_as_string")]
    ivy_sold: u64,
    #[serde(serialize_with = "serialize_u64_as_string")]
    ivy_curve_max: u64,
    curve_input_scale: f32,
    mkt_cap_usd: f32,
    change_pct_24h: f32,
}

#[derive(Serialize)]
struct IvyUpdateEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    #[serde(serialize_with = "serialize_u64_as_string")]
    ivy_sold: u64,
}

// Add this new query params struct for ivy stream
#[derive(Deserialize)]
pub struct IvyStreamParams {
    chart: ChartKind,
    #[serde(default = "default_chart_count")]
    chart_count: usize,
}

#[derive(Serialize)]
struct SyncInitialContextEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    candles: Vec<Candle>,
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

// Add query params for sync stream
#[derive(Deserialize)]
pub struct SyncStreamParams {
    chart: ChartKind,
    #[serde(default = "default_chart_count")]
    chart_count: usize,
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

#[derive(Serialize)]
struct TradeEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    user: Public,
    asset: Public,
    symbol: String,
    icon_url: String,
    volume_usd: f32,
    mkt_cap_usd: f32,
    is_buy: bool,
}

// Add this new event type near the other SSE event structs (around line 100)
#[derive(Serialize)]
struct AssetEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    name: String,
    symbol: String,
    address: Public,
    icon_url: String,
    short_desc: String,
    create_timestamp: u64,
    mkt_cap_usd: f32,
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
        let (_, comments) = data.games.get_comment_info(
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

        let comment_rx = data
            .games
            .subscribe_to_game_comments(&address)
            .ok_or_else(|| {
                error(
                    "Failed to subscribe to game comments",
                    StatusCode::INTERNAL_SERVER_ERROR,
                )
            })?;

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

pub async fn stream_ivy(
    AxumState(state): AxumState<Arc<State>>,
    Query(params): Query<IvyStreamParams>,
) -> Result<Sse<impl Stream<Item = Result<SseEvent, axum::Error>>>, AppError> {
    // Get initial data and subscribe to updates
    let (initial_data, world_rx, chart_rx) = {
        let mut data = state.write().unwrap();

        // Get initial ivy chart data
        let candles = data
            .world
            .query_ivy_chart(params.chart, params.chart_count, 0);

        // Get world data
        let world_data = data.world.data();
        let ivy_price = data.world.price();
        let mkt_cap_usd = from_ivy_amount(world_data.ivy_sold + world_data.ivy_vested) * ivy_price;
        let change_pct_24h = data.world.ivy_change_24h();

        // Subscribe to updates
        let world_rx = data.world.subscribe();
        let chart_rx = data.world.ivy_charts.subscribe_to_kind(params.chart);

        let initial = IvyInitialContextEvent {
            event_type: "initial",
            candles,
            ivy_sold: world_data.ivy_sold,
            ivy_curve_max: world_data.ivy_curve_max,
            curve_input_scale: (world_data.curve_input_scale_num as f32)
                / (world_data.curve_input_scale_den as f32),
            mkt_cap_usd,
            change_pct_24h,
        };

        (initial, world_rx, chart_rx)
    };

    // Create the SSE stream
    let stream = async_stream::stream! {
        // Send initial context
        yield Ok(SseEvent::default()
            .event("context")
            .data(serde_json::to_string(&initial_data).unwrap()));

        // Convert receivers to streams
        let mut world_stream = BroadcastStream::new(world_rx);
        let mut chart_stream = BroadcastStream::new(chart_rx);

        loop {
            tokio::select! {
                // World updates (ivy_sold changes)
                Some(result) = world_stream.next() => {
                    match result {
                        Ok(world_update) => {
                            let event_data = IvyUpdateEvent {
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

// Add this handler function
pub async fn stream_trades(
    AxumState(state): AxumState<Arc<State>>,
) -> Result<Sse<impl Stream<Item = Result<SseEvent, axum::Error>>>, AppError> {
    // Get a receiver for trades
    let trades_rx = {
        let data = state.read().unwrap();
        data.trades_rx.clone()
    };

    // Create the SSE stream
    let stream = async_stream::stream! {
        let mut rx = trades_rx;

        loop {
            // Get the latest trade
            let trade_opt = rx.borrow_and_update().clone();

            // Only emit if we have an actual trade
            if let Some(trade) = trade_opt {
                let event_data = TradeEvent {
                    event_type: "trade",
                    user: trade.user,
                    asset: trade.asset,
                    symbol: trade.symbol,
                    icon_url: trade.icon_url,
                    volume_usd: trade.volume_usd,
                    mkt_cap_usd: trade.mkt_cap_usd,
                    is_buy: trade.is_buy,
                };

                yield Ok(SseEvent::default()
                    .event("trade")
                    .data(serde_json::to_string(&event_data).unwrap()));
            }

            // Wait for the value to change
            if rx.changed().await.is_err() {
                // Channel closed
                break;
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(std::time::Duration::from_secs(30))
            .text("keep-alive"),
    ))
}

// Add this handler function (you can place it after the stream_trades function)
pub async fn stream_assets(
    AxumState(state): AxumState<Arc<State>>,
) -> Result<Sse<impl Stream<Item = Result<SseEvent, axum::Error>>>, AppError> {
    // Get a receiver for assets
    let assets_rx = {
        let data = state.read().unwrap();
        data.assets_rx.resubscribe()
    };

    // Create the SSE stream
    let stream = async_stream::stream! {
        let mut rx = BroadcastStream::new(assets_rx);

        loop {
            match rx.next().await {
                Some(Ok(asset)) => {
                    let event_data = AssetEvent {
                        event_type: "asset",
                        name: asset.name,
                        symbol: asset.symbol,
                        address: asset.address,
                        icon_url: asset.icon_url,
                        short_desc: asset.description,
                        create_timestamp: asset.create_timestamp,
                        mkt_cap_usd: asset.mkt_cap_usd,
                    };

                    yield Ok(SseEvent::default()
                        .event("asset")
                        .data(serde_json::to_string(&event_data).unwrap()));
                }
                Some(Err(_)) => {
                    // Lagged receiver, continue
                    continue;
                }
                None => {
                    // Channel closed
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

pub async fn stream_sync(
    AxumState(state): AxumState<Arc<State>>,
    Path(address): Path<Public>,
    Query(params): Query<SyncStreamParams>,
) -> Result<Sse<impl Stream<Item = Result<SseEvent, axum::Error>>>, AppError> {
    // Get initial data and subscribe to updates
    let (initial_data, sync_rx, chart_rx, sol_price_rx) = {
        let mut data = state.write().unwrap();

        // Check if sync exists and get initial data
        let sync = data
            .syncs
            .get_sync_by_address(&address)
            .ok_or_else(|| error("Sync not found", StatusCode::NOT_FOUND))?;

        // Get initial chart data
        let candles = data.syncs.query_sync_chart(
            address,
            params.chart,
            params.chart_count,
            u64::MAX, // Get most recent candles
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
            sol_reserves,
            token_reserves,
            is_migrated: sync.is_migrated,
            pswap_pool: sync.pswap_pool,
            mkt_cap_usd: sync.mkt_cap_usd,
            change_pct_24h,
            sol_price,
        };

        (initial, sync_rx, chart_rx, sol_price_rx)
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
