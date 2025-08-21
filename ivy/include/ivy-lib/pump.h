#ifndef IVY_PUMP_H
#define IVY_PUMP_H

#include "context.h"
#include "packed.h"
#include "rw.h"
#include "types.h"
#include <solana_sdk.h>

// === Constants ===
static const address PUMP_PROGRAM_ID = {
    .x = {
        1,  86,  224, 246, 147, 102, 90,  207, 68,  219, 21, 104, 191, 23,  91, 170,
        81, 137, 203, 151, 245, 210, 255, 59,  101, 93,  43, 182, 253, 109, 24, 176,
    } // 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
};

static const address PUMP_GLOBAL = {
    .x = {
        58, 134, 94,  105, 238, 15,  84,  128, 202, 188, 246, 99,  87,  228, 220, 47,
        24, 213, 141, 69,  193, 234, 116, 137, 251, 55,  35,  217, 121, 60,  114, 166,
    } // 4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf
};

static const address PUMP_EVENT_AUTHORITY = {
    .x = {
        172, 241, 54,  235, 1,   252, 28, 78,  136, 61,  35,
        200, 181, 132, 74,  181, 154, 55, 246, 106, 221, 87,
        197, 233, 172, 59,  83,  224, 89, 211, 92,  100
    } // Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1
};

// Pump.fun `buy` discriminator
static const u64 PUMP_BUY_DISCRIMINATOR = 0xeaebda01123d0666;

// Pump.fun `sell` discriminator
static const u64 PUMP_SELL_DISCRIMINATOR = 0xad837f01a485e633;

// Pump.fun `BondingCurve` discriminator
static const u64 PUMP_BONDING_CURVE_DISCRIMINATOR = 0x60acd86037f8b717;

// Pump.fun `Global` discriminator
static const u64 PUMP_GLOBAL_DISCRIMINATOR = 0x7f726cc8b1e8e8a7;

// === Structures ===

typedef struct packed {
    u64 discriminator;
    u64 virtual_token_reserves;
    u64 virtual_sol_reserves;
    u64 real_token_reserves;
    u64 real_sol_reserves;
    u64 token_total_supply;
    bool complete;
    address creator;
} PumpBondingCurve;

typedef struct packed {
    u64 discriminator;
    bool initialized;
    address authority;
    address fee_recipient;
    u64 initial_virtual_token_reserves;
    u64 initial_virtual_sol_reserves;
    u64 initial_real_token_reserves;
    u64 token_total_supply;
    u64 fee_basis_points;
    address withdraw_authority;
    bool enable_migrate;
    u64 pool_migration_fee;
    u64 creator_fee_basis_points;
    // there are other fields,
    // but we don't care about them
} PumpGlobal;

// === Functions ===

// Try to deserialize a valid `PumpBondingCurve` from the provided account
static const PumpBondingCurve* pump_bonding_curve_load(
    const SolAccountInfo* bonding_curve
) {
    require(
        address_equal(bonding_curve->owner, &PUMP_PROGRAM_ID),
        "incorrect PF bonding curve owner"
    );
    require(
        bonding_curve->data_len >= sizeof(PumpBondingCurve),
        "incorrect PF bonding curve size"
    );
    const PumpBondingCurve* pbc = (const PumpBondingCurve*)bonding_curve->data;
    require(
        pbc->discriminator == PUMP_BONDING_CURVE_DISCRIMINATOR,
        "incorrect PF bonding curve discriminator"
    );
    return pbc;
}

// Try to deserialize a valid `PumpGlobal` from the provided account
static const PumpGlobal* pump_global_load(const SolAccountInfo* global) {
    require(
        address_equal(global->owner, &PUMP_PROGRAM_ID), "incorrect PF global owner"
    );
    require(global->data_len >= sizeof(PumpBondingCurve), "incorrect PF global size");
    const PumpGlobal* g = (const PumpGlobal*)global->data;
    require(
        g->discriminator == PUMP_GLOBAL_DISCRIMINATOR,
        "incorrect PF global discriminator"
    );
    return g;
}

/**
 * Buy tokens from a Pump.fun bonding curve (ExactOut)
 * Updated to match the current IDL with volume accumulators
 *
 * @param ctx The context containing account information
 * @param fee_recipient The current fee recipient (global->fee_recipient)
 * @param mint The token mint address
 * @param user The user's wallet address
 * @param bonding_curve The bonding curve to swap to/from
 * @param associated_bonding_curve The bonding curve's associated token account
 * @param associated_user The user's associated token account
 * @param creator_vault The creator's fee vault
 * @param global_volume_accumulator The global volume accumulator PDA
 * @param user_volume_accumulator The user's volume accumulator PDA
 * @param amount The amount of tokens to buy
 * @param max_sol_cost Maximum SOL willing to spend (slippage protection)
 * @param track_volume Whether to track volume for incentives
 */
static void pump_buy(
    const Context* ctx,
    address fee_recipient,
    address mint,
    address user,
    address bonding_curve,
    address associated_bonding_curve,
    address associated_user,
    address creator_vault,
    address global_volume_accumulator,
    address user_volume_accumulator,
    u64 amount,
    u64 max_sol_cost
) {
    // Build instruction data
    // discriminator (8) + amount (8) + max_sol_cost (8)
    u8 instruction_data[24];
    writer w = writer_new(instruction_data, sizeof(instruction_data));

    // Write discriminator
    writer_write_u64(&w, PUMP_BUY_DISCRIMINATOR);

    // Write arguments
    writer_write_u64(&w, amount);
    writer_write_u64(&w, max_sol_cost);

    // Prepare account metas (following exact order from IDL)
    address global = PUMP_GLOBAL;
    address system_program = SYSTEM_PROGRAM_ID;
    address token_program = TOKEN_PROGRAM_ID;
    address event_authority = PUMP_EVENT_AUTHORITY;
    address pump_program = PUMP_PROGRAM_ID;

    SolAccountMeta metas[14] = {
        {.pubkey = &global, .is_writable = false, .is_signer = false}, // 0: global
        {.pubkey = &fee_recipient,
         .is_writable = true,
         .is_signer = false}, // 1: fee_recipient
        {.pubkey = &mint, .is_writable = false, .is_signer = false}, // 2: mint
        {.pubkey = &bonding_curve,
         .is_writable = true,
         .is_signer = false}, // 3: bonding_curve
        {.pubkey = &associated_bonding_curve,
         .is_writable = true,
         .is_signer = false}, // 4: associated_bonding_curve
        {.pubkey = &associated_user,
         .is_writable = true,
         .is_signer = false}, // 5: associated_user
        {.pubkey = &user, .is_writable = true, .is_signer = true}, // 6: user
        {.pubkey = &system_program,
         .is_writable = false,
         .is_signer = false}, // 7: system_program
        {.pubkey = &token_program,
         .is_writable = false,
         .is_signer = false}, // 8: token_program
        {.pubkey = &creator_vault,
         .is_writable = true,
         .is_signer = false}, // 9: creator_vault
        {.pubkey = &event_authority,
         .is_writable = false,
         .is_signer = false}, // 10: event_authority
        {.pubkey = &pump_program,
         .is_writable = false,
         .is_signer = false}, // 11: program
        {.pubkey = &global_volume_accumulator,
         .is_writable = true,
         .is_signer = false}, // 12: global_volume_accumulator
        {.pubkey = &user_volume_accumulator,
         .is_writable = true,
         .is_signer = false} // 13: user_volume_accumulator
    };

    const SolInstruction instruction = {
        .program_id = &pump_program,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = instruction_data,
        .data_len = w.offset
    };

    context_invoke(ctx, &instruction, "Pump buy CPI failed");
}

/**
 * Sell tokens to a Pump.fun bonding curve
 * Updated to match the current IDL (without volume accumulators for sell)
 *
 * @param ctx The context containing account information
 * @param fee_recipient The Pump.fun fee recipient (global->fee_recipient)
 * @param mint The token mint address
 * @param user The user's wallet address
 * @param bonding_curve The bonding curve to swap into
 * @param associated_bonding_curve The bonding curve's associated token account
 * @param associated_user The user's associated token account
 * @param creator_vault The creator's fee vault
 * @param amount The amount of tokens to sell
 * @param min_sol_output Minimum SOL expected to receive (slippage protection)
 */
static void pump_sell(
    const Context* ctx,
    address fee_recipient,
    address mint,
    address user,
    address bonding_curve,
    address associated_bonding_curve,
    address associated_user,
    address creator_vault,
    u64 amount,
    u64 min_sol_output
) {
    // Build instruction data
    u8 instruction_data[24]; // discriminator + amount + min_sol_output
    writer w = writer_new(instruction_data, sizeof(instruction_data));

    // Write discriminator
    writer_write_u64(&w, PUMP_SELL_DISCRIMINATOR);

    // Write arguments
    writer_write_u64(&w, amount);
    writer_write_u64(&w, min_sol_output);

    // Prepare account metas (following exact order from IDL)
    address global = PUMP_GLOBAL;
    address system_program = SYSTEM_PROGRAM_ID;
    address token_program = TOKEN_PROGRAM_ID;
    address event_authority = PUMP_EVENT_AUTHORITY;
    address pump_program = PUMP_PROGRAM_ID;

    SolAccountMeta metas[12] = {
        {.pubkey = &global, .is_writable = false, .is_signer = false}, // 0: global
        {.pubkey = &fee_recipient,
         .is_writable = true,
         .is_signer = false}, // 1: fee_recipient
        {.pubkey = &mint, .is_writable = false, .is_signer = false}, // 2: mint
        {.pubkey = &bonding_curve,
         .is_writable = true,
         .is_signer = false}, // 3: bonding_curve
        {.pubkey = &associated_bonding_curve,
         .is_writable = true,
         .is_signer = false}, // 4: associated_bonding_curve
        {.pubkey = &associated_user,
         .is_writable = true,
         .is_signer = false}, // 5: associated_user
        {.pubkey = &user, .is_writable = true, .is_signer = true}, // 6: user
        {.pubkey = &system_program,
         .is_writable = false,
         .is_signer = false}, // 7: system_program
        {.pubkey = &creator_vault,
         .is_writable = true,
         .is_signer = false}, // 8: creator_vault
        {.pubkey = &token_program,
         .is_writable = false,
         .is_signer = false}, // 9: token_program
        {.pubkey = &event_authority,
         .is_writable = false,
         .is_signer = false}, // 10: event_authority
        {.pubkey = &pump_program,
         .is_writable = false,
         .is_signer = false} // 11: program
    };

    const SolInstruction instruction = {
        .program_id = &pump_program,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = instruction_data,
        .data_len = w.offset
    };

    context_invoke(ctx, &instruction, "Pump sell CPI failed");
}

#endif // IVY_PUMP_H
