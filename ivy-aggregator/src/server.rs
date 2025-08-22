use crate::routes::stream_assets::stream_assets;
use crate::routes::stream_game::stream_game;
use crate::routes::stream_ivy::stream_ivy;
use crate::routes::stream_sync::stream_sync;
use crate::routes::stream_trades::stream_trades;
use crate::routes::sync::get_sync;
use crate::state::State;
use axum::extract::Request;
use axum::ServiceExt;
use axum::{
    routing::{get, post},
    Router,
};
use std::{net::SocketAddr, sync::Arc};
use tower_http::cors::CorsLayer;
use tower_http::normalize_path::NormalizePathLayer;
use tower_layer::Layer;

// Import route handlers
use crate::routes::assets::{assets_count, get_asset, list_assets, pnl_board, volume_board};
use crate::routes::comments::get_comments;
use crate::routes::games::{get_burn_info, get_deposit_info, get_game, get_withdraw_info};
use crate::routes::info::{global_info, ivy_info};
use crate::routes::misc::{root, validate_address};
use crate::routes::price::ivy_price;
use crate::routes::volume::{get_volume, volume_multiple};

pub fn create_router(state: Arc<State>) -> Router {
    Router::new()
        // API Root
        .route("/", get(root))
        // === GAME ROUTES ===
        .route("/games/{address}", get(get_game))
        // === SYNC ROUTES ===
        .route("/syncs/{address}", get(get_sync))
        // === ASSETS ROUTES ===
        .route("/assets", get(list_assets))
        .route("/assets/count", get(assets_count))
        .route("/assets/{address}", get(get_asset))
        .route("/assets/{address}/volume_board", get(volume_board))
        .route("/assets/{address}/pnl_board", get(pnl_board))
        .route(
            "/assets/{address}/pnl/{user}",
            get(crate::routes::assets::get_pnl),
        )
        // === VOLUME ROUTES ===
        .route("/volume/{user}", get(get_volume))
        .route("/volume/multiple", post(volume_multiple))
        // === COMMENT ROUTES ===
        .route("/comments/{game}", get(get_comments))
        // === STREAMING ROUTES ===
        .route("/games/{address}/stream", get(stream_game))
        .route("/ivy/stream", get(stream_ivy))
        .route("/trades/stream", get(stream_trades))
        .route("/assets/stream", get(stream_assets))
        .route("/syncs/{address}/stream", get(stream_sync))
        // === PRICE ROUTES ===
        .route("/ivy/price", get(ivy_price))
        // === DEPOSIT ROUTE ===
        .route("/games/{game}/burns/{id}", get(get_burn_info))
        .route("/games/{game}/deposits/{id}", get(get_deposit_info))
        .route("/games/{game}/withdrawals/{id}", get(get_withdraw_info))
        // === INFO ROUTES ===
        .route("/ivy/info", get(ivy_info))
        .route("/global-info", get(global_info))
        // === MISC ROUTES ===
        .route("/validate/address/{address}", get(validate_address))
        // Add state and CORS
        .with_state(state)
        .layer(CorsLayer::permissive())
}

pub struct Server {
    addr: SocketAddr,
    state: Arc<State>,
}

impl Server {
    pub const fn new(addr: SocketAddr, state: Arc<State>) -> Self {
        Self { addr, state }
    }
    pub async fn run(self) -> Result<(), Box<dyn std::error::Error>> {
        let app = create_router(self.state);
        let app = NormalizePathLayer::trim_trailing_slash().layer(app);
        println!("Now listening on {}", self.addr);

        let listener = tokio::net::TcpListener::bind(self.addr).await?;
        axum::serve(listener, ServiceExt::<Request>::into_make_service(app)).await?;

        Ok(())
    }
}
