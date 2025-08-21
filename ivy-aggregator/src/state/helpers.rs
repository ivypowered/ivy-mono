/// Normalize a string for searching: trim, lowercase, ASCII only, no spaces.
pub fn normalize_string(s: &str) -> String {
    s.trim()
        .chars()
        .filter(|c| c.is_ascii())
        .filter(|c| !c.is_whitespace())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

/// Calculate the hot score of a game based on market cap and age.
pub fn calculate_hot_score(mkt_cap_usd: f32, age_seconds: u64) -> f32 {
    let age_in_hours = (age_seconds as f32) / 3600.0;
    // Score formula: market_cap / (age_in_hours + 2)^1.8
    mkt_cap_usd / (age_in_hours + 2.0).powf(1.8)
}
