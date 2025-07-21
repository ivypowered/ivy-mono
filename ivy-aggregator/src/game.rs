use serde::ser::Serializer;
use serde::Serialize;

use crate::public::Public;

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
    pub cover_url: String,
    pub metadata_url: String,
    pub create_timestamp: u64,
    #[serde(serialize_with = "serialize_u64_as_string")]
    pub ivy_balance: u64,
    #[serde(serialize_with = "serialize_u64_as_string")]
    pub game_balance: u64,
    #[serde(serialize_with = "serialize_u64_as_string")]
    pub starting_ivy_balance: u64,
    pub comment_buf_index: u64,
    #[serde(skip)]
    pub normalized_name: String,
    pub last_price_usd: f32,
    pub mkt_cap_usd: f32,
    pub change_pct_24h: f32,
}

fn serialize_u64_as_string<S>(value: &u64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}
