#ifndef IVY_ATA_H
#define IVY_ATA_H

#include "context.h"
#include "types.h"

static const u8 ATA_CREATE_IDEMPOTENT = 1;

/// Call `createTokenAccountIdempotent`.
/// Requires the given accounts,
/// plus the system + token program
/// to exist in the account list.
static void ata_create_idempotent(
    const Context* ctx,
    address payer_address,
    address associated_token_address,
    address owner_address,
    address mint_address
) {
    // Prepare instruction data - just a single byte (1)
    u8 instruction_data[1] = {ATA_CREATE_IDEMPOTENT};

    // Get system program ID and token program ID
    address system_program_id = SYSTEM_PROGRAM_ID;
    address token_program_id = TOKEN_PROGRAM_ID;

    // Setup account metas (6 accounts)
    SolAccountMeta metas[6] = {
        {.pubkey = &payer_address, .is_writable = true, .is_signer = true},
        {.pubkey = &associated_token_address, .is_writable = true, .is_signer = false},
        {.pubkey = &owner_address, .is_writable = false, .is_signer = false},
        {.pubkey = &mint_address, .is_writable = false, .is_signer = false},
        {.pubkey = &system_program_id, .is_writable = false, .is_signer = false},
        {.pubkey = &token_program_id, .is_writable = false, .is_signer = false}
    };

    // Create the instruction
    address ata_program_id = ATA_PROGRAM_ID;
    const SolInstruction ix = {
        .program_id = &ata_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = instruction_data,
        .data_len = sizeof(instruction_data)
    };

    // Invoke the instruction
    require(
        sol_invoke(&ix, ctx->ka, ctx->ka_num) == SUCCESS,
        "ATA Create Idempotent CPI failed"
    );
}

#endif
