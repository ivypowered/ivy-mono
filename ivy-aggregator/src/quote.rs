use serde::{Serialize, Serializer};

fn serialize_u64_as_string<S>(value: &u64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

#[derive(Clone, Copy, Serialize)]
pub struct Quote {
    #[serde(serialize_with = "serialize_u64_as_string")]
    pub output_amount: u64,
    pub input_amount_usd: f32,
    pub output_amount_usd: f32,
    pub price_impact_bps: u16,
}

impl Quote {
    pub const fn zero() -> Quote {
        Quote {
            output_amount: 0,
            input_amount_usd: 0.0,
            output_amount_usd: 0.0,
            price_impact_bps: 0,
        }
    }
}
