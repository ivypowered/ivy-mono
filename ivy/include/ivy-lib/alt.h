#ifndef IVY_LIB_ALT_H
#define IVY_LIB_ALT_H

#include "context.h"
#include "heap.h"
#include "rw.h"
#include "types.h" // For require
#include <solana_sdk.h>

// === Enums ===

typedef enum {
    ALT_CREATE = 0,
    ALT_FREEZE = 1,
    ALT_EXTEND = 2,
    ALT_DEACTIVATE = 3,
    ALT_CLOSE = 4
} AltInstruction;

// === Functions ===

static void alt_create(
    const Context* ctx,
    address lookup_table_address,
    address authority_address,
    address payer_address,
    u64 recent_slot,
    u8 bump_seed
) {
    // Prepare SolInstruction data
    u8 instruction_data[13]; // 4 bytes discriminator + 8 bytes slot + 1 byte bump
    writer w = writer_new(instruction_data, sizeof(instruction_data));

    writer_write_u32(&w, ALT_CREATE);
    writer_write_u64(&w, recent_slot);
    writer_write_u8(&w, bump_seed);

    address system_program_id = SYSTEM_PROGRAM_ID;
    SolAccountMeta metas[4] = {
        {.pubkey = &lookup_table_address, .is_writable = true, .is_signer = false},
        {.pubkey = &authority_address, .is_writable = false, .is_signer = false},
        {.pubkey = &payer_address, .is_writable = true, .is_signer = true},
        {.pubkey = &system_program_id, .is_writable = false, .is_signer = false}
    };

    address alt_program_id = ALT_PROGRAM_ID;
    const SolInstruction ix = {
        .program_id = &alt_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = instruction_data,
        .data_len = w.offset
    };

    context_invoke(ctx, &ix, "ALT Create CPI failed");
}

static void alt_freeze_signed(
    const Context* ctx,
    address lookup_table_address,
    address authority_address,
    const slice* authority_seeds,
    u64 authority_seeds_len
) {
    // Prepare SolInstruction data - just the discriminator
    u8 instruction_data[4];
    writer w = writer_new(instruction_data, sizeof(instruction_data));

    writer_write_u32(&w, ALT_FREEZE);

    SolAccountMeta metas[2] = {
        {.pubkey = &lookup_table_address, .is_writable = true, .is_signer = false},
        {.pubkey = &authority_address, .is_writable = false, .is_signer = true}
    };

    address alt_program_id = ALT_PROGRAM_ID;
    const SolInstruction ix = {
        .program_id = &alt_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = instruction_data,
        .data_len = w.offset
    };

    SolSignerSeeds signer_seeds = {.addr = authority_seeds, .len = authority_seeds_len};

    context_invoke_signed(ctx, &ix, signer_seeds, "ALT Freeze CPI failed");
}

static void alt_extend_signed(
    const Context* ctx,
    address lookup_table_address,
    address authority_address,
    address payer_address,
    const address* new_addresses,
    u64 new_addresses_len,
    const slice* authority_seeds,
    u64 authority_seeds_len
) {
    // Calculate data size: 4 bytes discriminator + 8 bytes length + 32 bytes per address
    u64 data_size = 4 + 8 + (32 * new_addresses_len);
    require(data_size <= 1232, "SolInstruction data too large");

    // Prepare SolInstruction data
    u8* instruction_data = (u8*)heap_alloc(data_size);

    writer w = writer_new(instruction_data, data_size);
    writer_write_u32(&w, ALT_EXTEND);
    writer_write_u64(&w, new_addresses_len);

    // Write each address
    for (u64 i = 0; i < new_addresses_len; i++) {
        writer_write_address(&w, &new_addresses[i]);
    }

    address system_program_id = SYSTEM_PROGRAM_ID;
    SolAccountMeta metas[4] = {
        {.pubkey = &lookup_table_address, .is_writable = true, .is_signer = false},
        {.pubkey = &authority_address, .is_writable = false, .is_signer = true},
        {.pubkey = &payer_address, .is_writable = true, .is_signer = true},
        {.pubkey = &system_program_id, .is_writable = false, .is_signer = false}
    };

    address alt_program_id = ALT_PROGRAM_ID;
    const SolInstruction ix = {
        .program_id = &alt_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = instruction_data,
        .data_len = w.offset
    };

    SolSignerSeeds signer_seeds = {.addr = authority_seeds, .len = authority_seeds_len};

    context_invoke_signed(ctx, &ix, signer_seeds, "ALT Extend CPI failed");
}

#endif // IVY_ALT_H
