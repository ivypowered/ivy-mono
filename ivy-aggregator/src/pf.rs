use borsh::BorshDeserialize;
use serde::{Deserialize, Serialize};

use crate::types::public::Public;

pub const PF_PROGRAM: Public = Public([
    1, 86, 224, 246, 147, 102, 90, 207, 68, 219, 21, 104, 191, 23, 91, 170, 81, 137, 203, 151, 245,
    210, 255, 59, 101, 93, 43, 182, 253, 109, 24, 176,
]);
pub const PA_PROGRAM: Public = Public([
    12, 20, 222, 252, 130, 94, 198, 118, 148, 37, 8, 24, 187, 101, 64, 101, 244, 41, 141, 49, 86,
    213, 113, 180, 212, 248, 9, 12, 24, 233, 168, 99,
]);
pub const PF_TRADE_EVENT_TAG: u64 = 0xee61e64ed37fdbbd;
pub const PF_MIGRATE_EVENT_TAG: u64 = 0x94ea945cb95de9bd;
pub const PA_BUY_EVENT_TAG: u64 = 0x7777f52c1f52f467;
pub const PA_SELL_EVENT_TAG: u64 = 0x2adc03a50a372f3e;

#[derive(BorshDeserialize, Serialize, Deserialize, Debug, Clone, Copy)]
pub struct PfTradeEvent {
    pub mint: Public,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub is_buy: bool,
    pub user: Public,
    pub timestamp: i64,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub fee_recipient: Public,
    pub fee_basis_points: u64,
    pub fee: u64,
    pub creator: Public,
    pub creator_fee_basis_points: u64,
    pub creator_fee: u64,
    pub track_volume: bool,
    pub total_unclaimed_tokens: u64,
    pub total_claimed_tokens: u64,
    pub current_sol_volume: u64,
    pub last_update_timestamp: i64,
}

#[derive(BorshDeserialize, Serialize, Deserialize, Debug, Clone, Copy)]
pub struct PfMigrationEvent {
    pub user: Public,
    pub mint: Public,
    pub mint_amount: u64,
    pub sol_amount: u64,
    pub pool_migration_fee: u64,
    pub bonding_curve: Public,
    pub timestamp: i64,
    pub pool: Public,
}

#[derive(BorshDeserialize, Serialize, Deserialize, Debug, Clone, Copy)]
pub struct PaBuyEvent {
    pub timestamp: i64,
    pub base_amount_out: u64,
    pub max_quote_amount_in: u64,
    pub user_base_token_reserves: u64,
    pub user_quote_token_reserves: u64,
    pub pool_base_token_reserves: u64,
    pub pool_quote_token_reserves: u64,
    pub quote_amount_in: u64,
    pub lp_fee_basis_points: u64,
    pub lp_fee: u64,
    pub protocol_fee_basis_points: u64,
    pub protocol_fee: u64,
    pub quote_amount_in_with_lp_fee: u64,
    pub user_quote_amount_in: u64,
    pub pool: Public,
    pub user: Public,
    pub user_base_token_account: Public,
    pub user_quote_token_account: Public,
    pub protocol_fee_recipient: Public,
    pub protocol_fee_recipient_token_account: Public,
    pub coin_creator: Public,
    pub coin_creator_fee_basis_points: u64,
    pub coin_creator_fee: u64,
    pub track_volume: bool,
    pub total_unclaimed_tokens: u64,
    pub total_claimed_tokens: u64,
    pub current_sol_volume: u64,
    pub last_update_timestamp: i64,
}

#[derive(BorshDeserialize, Serialize, Deserialize, Debug, Clone, Copy)]
pub struct PaSellEvent {
    pub timestamp: i64,
    pub base_amount_in: u64,
    pub min_quote_amount_out: u64,
    pub user_base_token_reserves: u64,
    pub user_quote_token_reserves: u64,
    pub pool_base_token_reserves: u64,
    pub pool_quote_token_reserves: u64,
    pub quote_amount_out: u64,
    pub lp_fee_basis_points: u64,
    pub lp_fee: u64,
    pub protocol_fee_basis_points: u64,
    pub protocol_fee: u64,
    pub quote_amount_out_without_lp_fee: u64,
    pub user_quote_amount_out: u64,
    pub pool: Public,
    pub user: Public,
    pub user_base_token_account: Public,
    pub user_quote_token_account: Public,
    pub protocol_fee_recipient: Public,
    pub protocol_fee_recipient_token_account: Public,
    pub coin_creator: Public,
    pub coin_creator_fee_basis_points: u64,
    pub coin_creator_fee: u64,
}
