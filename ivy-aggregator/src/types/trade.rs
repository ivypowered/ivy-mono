use serde::Serialize;

use crate::types::public::Public;

#[derive(Serialize, Clone)]
pub struct Trade {
    pub user: Public,
    pub asset: Public,
    pub symbol: String,
    pub icon_url: String,
    pub volume_usd: f32,
    pub mkt_cap_usd: f32,
    pub is_buy: bool,
}
