use crate::routes::types::AppError;
use crate::state::State;
use crate::types::chart::Candle;
use crate::types::charts::ChartKind;
use crate::types::event::serialize_u64_as_string;
use crate::util::from_ivy_amount;
use axum::extract::{Query, State as AxumState};
use axum::response::sse::{Event as SseEvent, Sse};
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt as _;

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

fn default_chart_count() -> usize {
    100
}

#[derive(Serialize)]
struct CandleUpdateEvent {
    #[serde(rename = "type")]
    event_type: &'static str,
    candle: Candle,
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
