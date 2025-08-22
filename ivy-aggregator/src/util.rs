use std::time::{SystemTime, UNIX_EPOCH};

pub fn from_game_amount(game_amount: u64) -> f32 {
    return (game_amount as f32) / 1_000_000_000.0; // 9 decimals
}

pub fn from_ivy_amount(ivy_amount: u64) -> f32 {
    return (ivy_amount as f32) / 1_000_000_000.0; // 9 decimals
}

pub fn from_sol_amount(sol_amount: u64) -> f32 {
    return (sol_amount as f32) / 1_000_000_000.0; // 9 decimals
}

pub fn from_token_amount(token_amount: u64) -> f32 {
    // PF tokens are 6 decimals, our synced ones are 9 decimals
    return (token_amount as f32) / 1_000_000_000.0; // 9 decimals
}

pub fn from_usdc_amount(usdc_amount: u64) -> f32 {
    return (usdc_amount as f32) / 1_000_000.0; // 6 decimals
}

/// Convert a float USD value into a `u64` tenths of a cent (mils)
pub fn usd_to_mil(v: f32) -> u64 {
    if !v.is_normal() {
        return 0;
    }
    (v * 1000.0) as u64
}

/// Convert tenths of a cent into a float USD value
pub fn mil_to_usd(v: u64) -> f32 {
    (v as f32) / 1000.0
}

/// Return the current unix timestamp
pub fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
