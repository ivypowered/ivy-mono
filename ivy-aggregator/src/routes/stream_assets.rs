use crate::routes::types::AppError;
use crate::state::State;
use crate::types::public::Public;
use axum::extract::State as AxumState;
use axum::response::sse::{Event as SseEvent, Sse};
use futures::stream::Stream;
use serde::Serialize;
use std::sync::Arc;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt as _;

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
