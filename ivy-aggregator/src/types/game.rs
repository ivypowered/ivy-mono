use serde::Serialize;

use crate::types::asset::Asset;
use crate::types::event::serialize_u64_as_string;
use crate::types::public::Public;

#[derive(Clone, Serialize)]
pub struct Game {
    pub name: String,
    pub symbol: String,
    pub address: Public,
    pub mint: Public,
    pub swap_alt: Public,
    pub owner: Public,
    pub withdraw_authority: Public,
    pub game_url: String,
    pub icon_url: String,
    pub description: String,
    pub metadata_url: String,
    pub create_timestamp: u64,
    #[serde(serialize_with = "serialize_u64_as_string")]
    pub ivy_balance: u64,
    #[serde(serialize_with = "serialize_u64_as_string")]
    pub game_balance: u64,
    #[serde(serialize_with = "serialize_u64_as_string")]
    pub starting_ivy_balance: u64,
    #[serde(skip)]
    pub starting_game_balance: u64,
    #[serde(skip)]
    pub normalized_name: String,
    pub last_price_usd: f32,
    pub mkt_cap_usd: f32,
    pub change_pct_24h: f32,
}

impl Game {
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
