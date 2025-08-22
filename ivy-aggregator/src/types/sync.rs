use serde::Serialize;

use crate::types::{asset::Asset, public::Public};

#[derive(Clone, Serialize)]
pub struct Sync {
    pub name: String,
    pub symbol: String,
    pub address: Public, // Sync PDA
    pub external_mint: Public,
    pub create_timestamp: u64,
    pub metadata_url: String,
    pub icon_url: String,
    pub game_url: String,
    pub description: String,

    pub is_migrated: bool,
    pub pswap_pool: Option<Public>,

    pub last_price_usd: f32,
    pub mkt_cap_usd: f32,
    pub change_pct_24h: f32,

    pub sol_reserves: u64,
    pub token_reserves: u64,
}

impl Sync {
    pub fn to_asset(&self) -> Asset {
        Asset {
            name: self.name.clone(),
            symbol: self.symbol.clone(),
            address: self.address,
            icon_url: self.icon_url.clone(),
            description: self.description.clone(),
            create_timestamp: self.create_timestamp,
            mkt_cap_usd: self.mkt_cap_usd,
        }
    }
}
