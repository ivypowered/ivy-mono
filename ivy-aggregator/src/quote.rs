use serde::Serialize;

#[derive(Clone, Copy, Serialize)]
pub struct Quote {
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
