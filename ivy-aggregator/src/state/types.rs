use serde::Serialize;

use crate::types::asset::Asset;
use crate::types::chart::Candle;
use crate::types::public::Public;
use crate::types::signature::Signature;

#[derive(Serialize)]
pub struct VlbEntry {
    pub user: Public,
    pub volume: f32,
}

#[derive(Clone, Serialize)]
pub struct Comment {
    pub index: u64,
    pub user: Public,
    pub timestamp: u64,
    pub text: String,
}

#[derive(Clone, Serialize)]
pub struct CommentInfo {
    pub total: usize,
    pub comments: Vec<Comment>,
}

#[derive(Clone, Copy, Serialize)]
pub struct BurnInfo {
    pub signature: Signature,
    pub timestamp: u64,
}

#[derive(Clone, Copy, Serialize)]
pub struct DepositInfo {
    pub signature: Signature,
    pub timestamp: u64,
}

#[derive(Clone, Copy, Serialize)]
pub struct WithdrawInfo {
    pub signature: Signature,
    pub timestamp: u64,
    pub withdraw_authority: Public,
}

#[derive(Clone, Serialize)]
pub struct ChartResponse {
    pub candles: Vec<Candle>,
    pub mkt_cap_usd: f32,
    pub change_24h: f32,
}

#[derive(Clone, Copy, Serialize)]
pub struct IvyInfo {
    pub create_timestamp: u64,
    pub ivy_initial_liquidity: f32,
    pub game_initial_liquidity: f32,
    pub ivy_price: f32,
    pub ivy_mkt_cap: f32,
    pub ivy_change_24h: f32,
}

#[derive(Clone, Serialize)]
pub struct GlobalInfo {
    pub games_listed: u64,
    pub tvl: f32,
    pub volume_24h: f32,
    pub featured_assets: Vec<Asset>,
}

#[derive(Serialize, Clone, Copy)]
pub struct PnlEntry {
    pub user: Public,
    pub in_usd: f32,
    pub out_usd: f32,
    pub position: f32,
}

#[derive(Serialize, Clone, Copy)]
pub struct PnlResponse {
    pub in_usd: f32,
    pub out_usd: f32,
    pub position: f32,
    pub price: f32,
}
