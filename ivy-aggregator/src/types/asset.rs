use serde::Serialize;

use crate::types::public::Public;

#[derive(Serialize, Clone)]
pub struct Asset {
    pub name: String,
    pub symbol: String,
    pub address: Public,
    pub icon_url: String,
    pub short_desc: String,
    pub create_timestamp: u64,
    pub mkt_cap_usd: f32,
}
