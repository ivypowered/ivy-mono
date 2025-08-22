use crate::routes::types::AppError;
use crate::state::State;
use crate::types::public::Public;
use axum::extract::State as AxumState;
use axum::response::sse::{Event as SseEvent, Sse};
use futures::stream::Stream;
use serde::Serialize;
use std::sync::Arc;

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
