#ifndef IVY_PSWAP_H
#define IVY_PSWAP_H

#include "context.h"
#include "rw.h"
#include "types.h"
#include "ivy-lib/packed.h"
#include <solana_sdk.h>

// === Constants ===
static const address PSWAP_PROGRAM_ID = {
    .x = {
        12, 20,  222, 252, 130, 94,  198, 118, 148, 37, 8,  24, 187, 101, 64, 101, 244,
        41, 141, 49,  86,  213, 113, 180, 212, 248, 9,  12, 24, 233, 168, 99
    } // pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA
};

// PumpSwap `buy` discriminator
static const u64 PSWAP_BUY_DISCRIMINATOR = 0xeaebda01123d0666;

// PumpSwap `sell` discriminator
static const u64 PSWAP_SELL_DISCRIMINATOR = 0xad837f01a485e633;

// PumpSwap `Pool` account discriminator
static const u64 PSWAP_POOL_DISCRIMINATOR = 0xbc6db111046d9af1;

// PumpSwap `GlobalConfig` account discriminator
static const u64 PSWAP_GLOBAL_CONFIG_DISCRIMINATOR = 0xd9b0fca0ca9c0895;

// === Data Structures ===

// PumpSwap `Pool` account structure
typedef struct packed {
    u64 discriminator;
    u8 pool_bump;
    u16 index;
    address creator;
    address base_mint;
    address quote_mint;
    address lp_mint;
    address pool_base_token_account;
    address pool_quote_token_account;
    u64 lp_supply;
    address coin_creator;
} PswapPool;

// PumpSwap `GlobalConfig` account structure
typedef struct packed {
    u64 discriminator;
    address admin;
    u64 lp_fee_basis_points;
    u64 protocol_fee_basis_points;
    u8 disable_flags;
    address protocol_fee_recipients[8];
    u64 coin_creator_fee_basis_points;
    address admin_set_coin_creator_authority;
} PswapGlobalConfig;

// === Helper Functions ===

/**
 * Load a PumpSwap pool account
 * @param account The account info containing the pool data
 * @return Pointer to the pool data
 */
static const PswapPool* pswap_pool_load(const SolAccountInfo* pool) {
    require(address_equal(pool->owner, &PSWAP_PROGRAM_ID), "incorrect PF pool owner");
    require(pool->data_len >= sizeof(PswapPool), "incorrect PF pool size");
    const PswapPool* p = (const PswapPool*)pool->data;
    require(
        p->discriminator == PSWAP_POOL_DISCRIMINATOR, "incorrect PF pool discriminator"
    );
    return p;
}

/**
 * Load a PumpSwap global config account
 * @param account The account info containing the global config data
 * @return Pointer to the global config data
 */
static const PswapGlobalConfig* pswap_global_config_load(
    const SolAccountInfo* global_config
) {
    require(
        address_equal(global_config->owner, &PSWAP_PROGRAM_ID),
        "incorrect PF global config owner"
    );
    require(
        global_config->data_len >= sizeof(PswapGlobalConfig),
        "incorrect PF global config size"
    );
    const PswapGlobalConfig* gc = (const PswapGlobalConfig*)global_config->data;
    require(
        gc->discriminator == PSWAP_GLOBAL_CONFIG_DISCRIMINATOR,
        "incorrect PF global config discriminator"
    );
    return gc;
}

// === Main Functions ===

/**
 * Buy tokens from a PumpSwap pool (quote -> base)
 *
 * @param ctx The context containing account information
 * @param pool The pool address to buy from
 * @param user The user's wallet address
 * @param global_config The global config PDA address
 * @param base_mint The base token mint
 * @param quote_mint The quote token mint
 * @param user_base_token_account The user's base token account
 * @param user_quote_token_account The user's quote token account
 * @param pool_base_token_account The pool's base token account
 * @param pool_quote_token_account The pool's quote token account
 * @param protocol_fee_recipient The protocol fee recipient address
 * @param protocol_fee_recipient_token_account The protocol fee recipient's token account
 * @param base_token_program The base token program (Token or Token2022)
 * @param quote_token_program The quote token program (Token or Token2022)
 * @param event_authority The event authority PDA
 * @param coin_creator_vault_ata The coin creator's vault ATA
 * @param coin_creator_vault_authority The coin creator vault authority PDA
 * @param global_volume_accumulator The global volume accumulator PDA
 * @param user_volume_accumulator The user volume accumulator PDA
 * @param base_amount_out The amount of base tokens to buy
 * @param max_quote_amount_in Maximum quote tokens willing to spend
 * @param track_volume Whether to track volume (for incentives)
 */
static void pswap_buy(
    const Context* ctx,
    address pool,
    address user,
    address global_config,
    address base_mint,
    address quote_mint,
    address user_base_token_account,
    address user_quote_token_account,
    address pool_base_token_account,
    address pool_quote_token_account,
    address protocol_fee_recipient,
    address protocol_fee_recipient_token_account,
    address base_token_program,
    address quote_token_program,
    address event_authority,
    address coin_creator_vault_ata,
    address coin_creator_vault_authority,
    address global_volume_accumulator,
    address user_volume_accumulator,
    u64 base_amount_out,
    u64 max_quote_amount_in
) {
    // Build instruction data
    // discriminator (8) + base_amount_out (8) + max_quote_amount_in (8)
    u8 instruction_data[24];
    writer w = writer_new(instruction_data, sizeof(instruction_data));

    // Write discriminator
    writer_write_u64(&w, PSWAP_BUY_DISCRIMINATOR);

    // Write arguments
    writer_write_u64(&w, base_amount_out);
    writer_write_u64(&w, max_quote_amount_in);

    // Prepare account metas
    address system_program = SYSTEM_PROGRAM_ID;
    address associated_token_program = ATA_PROGRAM_ID;
    address pswap_program = PSWAP_PROGRAM_ID;

    SolAccountMeta metas[21] = {
        {.pubkey = &pool, .is_writable = false, .is_signer = false},
        {.pubkey = &user, .is_writable = true, .is_signer = true},
        {.pubkey = &global_config, .is_writable = false, .is_signer = false},
        {.pubkey = &base_mint, .is_writable = false, .is_signer = false},
        {.pubkey = &quote_mint, .is_writable = false, .is_signer = false},
        {.pubkey = &user_base_token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &user_quote_token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &pool_base_token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &pool_quote_token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &protocol_fee_recipient, .is_writable = false, .is_signer = false},
        {.pubkey = &protocol_fee_recipient_token_account,
         .is_writable = true,
         .is_signer = false},
        {.pubkey = &base_token_program, .is_writable = false, .is_signer = false},
        {.pubkey = &quote_token_program, .is_writable = false, .is_signer = false},
        {.pubkey = &system_program, .is_writable = false, .is_signer = false},
        {.pubkey = &associated_token_program, .is_writable = false, .is_signer = false},
        {.pubkey = &event_authority, .is_writable = false, .is_signer = false},
        {.pubkey = &pswap_program, .is_writable = false, .is_signer = false},
        {.pubkey = &coin_creator_vault_ata, .is_writable = true, .is_signer = false},
        {.pubkey = &coin_creator_vault_authority,
         .is_writable = false,
         .is_signer = false},
        {.pubkey = &global_volume_accumulator, .is_writable = true, .is_signer = false},
        {.pubkey = &user_volume_accumulator, .is_writable = true, .is_signer = false}
    };

    const SolInstruction instruction = {
        .program_id = &pswap_program,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = instruction_data,
        .data_len = w.offset
    };

    context_invoke(ctx, &instruction, "PSwap buy CPI failed");
}

/**
 * Sell tokens to a PumpSwap pool (base -> quote)
 *
 * @param ctx The context containing account information
 * @param pool The pool address to sell to
 * @param user The user's wallet address
 * @param global_config The global config PDA address
 * @param base_mint The base token mint
 * @param quote_mint The quote token mint
 * @param user_base_token_account The user's base token account
 * @param user_quote_token_account The user's quote token account
 * @param pool_base_token_account The pool's base token account
 * @param pool_quote_token_account The pool's quote token account
 * @param protocol_fee_recipient The protocol fee recipient address
 * @param protocol_fee_recipient_token_account The protocol fee recipient's token account
 * @param base_token_program The base token program (Token or Token2022)
 * @param quote_token_program The quote token program (Token or Token2022)
 * @param coin_creator_vault_ata The coin creator's vault ATA
 * @param coin_creator_vault_authority The coin creator vault authority PDA
 * @param base_amount_in The amount of base tokens to sell
 * @param min_quote_amount_out Minimum quote tokens expected to receive
 */
static void pswap_sell(
    const Context* ctx,
    address pool,
    address user,
    address global_config,
    address base_mint,
    address quote_mint,
    address user_base_token_account,
    address user_quote_token_account,
    address pool_base_token_account,
    address pool_quote_token_account,
    address protocol_fee_recipient,
    address protocol_fee_recipient_token_account,
    address base_token_program,
    address quote_token_program,
    address event_authority,
    address coin_creator_vault_ata,
    address coin_creator_vault_authority,
    u64 base_amount_in,
    u64 min_quote_amount_out
) {
    // Build instruction data
    // discriminator (8) + base_amount_in (8) + min_quote_amount_out (8)
    u8 instruction_data[24];
    writer w = writer_new(instruction_data, sizeof(instruction_data));

    // Write discriminator
    writer_write_u64(&w, PSWAP_SELL_DISCRIMINATOR);

    // Write arguments
    writer_write_u64(&w, base_amount_in);
    writer_write_u64(&w, min_quote_amount_out);

    // Prepare account metas
    address system_program = SYSTEM_PROGRAM_ID;
    address associated_token_program = ATA_PROGRAM_ID;
    address pswap_program = PSWAP_PROGRAM_ID;

    SolAccountMeta metas[19] = {
        {.pubkey = &pool, .is_writable = false, .is_signer = false},
        {.pubkey = &user, .is_writable = true, .is_signer = true},
        {.pubkey = &global_config, .is_writable = false, .is_signer = false},
        {.pubkey = &base_mint, .is_writable = false, .is_signer = false},
        {.pubkey = &quote_mint, .is_writable = false, .is_signer = false},
        {.pubkey = &user_base_token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &user_quote_token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &pool_base_token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &pool_quote_token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &protocol_fee_recipient, .is_writable = false, .is_signer = false},
        {.pubkey = &protocol_fee_recipient_token_account,
         .is_writable = true,
         .is_signer = false},
        {.pubkey = &base_token_program, .is_writable = false, .is_signer = false},
        {.pubkey = &quote_token_program, .is_writable = false, .is_signer = false},
        {.pubkey = &system_program, .is_writable = false, .is_signer = false},
        {.pubkey = &associated_token_program, .is_writable = false, .is_signer = false},
        {.pubkey = &event_authority, .is_writable = false, .is_signer = false},
        {.pubkey = &pswap_program, .is_writable = false, .is_signer = false},
        {.pubkey = &coin_creator_vault_ata, .is_writable = true, .is_signer = false},
        {.pubkey = &coin_creator_vault_authority,
         .is_writable = false,
         .is_signer = false}
    };

    const SolInstruction instruction = {
        .program_id = &pswap_program,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = instruction_data,
        .data_len = w.offset
    };

    context_invoke(ctx, &instruction, "PSwap sell CPI failed");
}

#endif // IVY_PSWAP_H
