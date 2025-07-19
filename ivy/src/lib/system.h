#ifndef IVY_SYSTEM_H
#define IVY_SYSTEM_H

#include "context.h"
#include "rent.h"
#include "rw.h"
#include "types.h"

typedef struct {
    u32 discriminator;
    u64 lamports;
    u64 size;
    address owner;
} SystemCreateAccount;

static void system_create_account(
    const Context* ctx,
    address destination,
    address payer,
    address owner,
    u64 size,
    const slice* seeds,
    u64 seeds_len
) {
    // Allocate buffer for SolInstruction data
    u8 data[4 + 8 + 8 + 32]; // discriminator + lamports + size + owner
    writer w = writer_new(data, sizeof(data));

    // Write SolInstruction data with exact layout
    writer_write_u32(&w, 0); // discriminator (0 = CreateAccount)
    writer_write_u64(&w, minimum_balance(size)); // lamports
    writer_write_u64(&w, size); // size
    writer_write_address(&w, &owner); // owner

    SolAccountMeta metas[2] = {
        {.pubkey = &payer, .is_writable = true, .is_signer = true},
        {.pubkey = &destination, .is_writable = true, .is_signer = true},
    };

    address system_program_id = SYSTEM_PROGRAM_ID;
    const SolInstruction ix = {
        .program_id = &system_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data,
        .data_len = w.offset // Use the writer's offset as the actual data length
    };

    SolSignerSeeds signer_seeds = {
        .addr = seeds,
        .len = seeds_len,
    };

    context_invoke_signed(ctx, &ix, signer_seeds, "System Create Account CPI failed");
}

static void system_create_account_with_seed(
    const Context* ctx,
    address from,
    address to,
    address base,
    const char* seed,
    u64 lamports,
    u64 space,
    address owner,
    const slice* base_seeds,
    u64 base_seeds_len
) {
    // Calculate seed length
    u64 seed_len = sol_strlen(seed);

    // Allocate buffer for the instruction data
    u64 instruction_data_len = 4 + 32 + 8 + seed_len + 8 + 8 + 32;
    u8* data = (u8*)heap_alloc(instruction_data_len);
    writer w = writer_new(data, instruction_data_len);

    // Serialize instruction data into buffer
    writer_write_u32(&w, 3); // CreateAccountWithSeed
    writer_write_address(&w, &base);
    writer_write_u64(&w, seed_len);
    writer_write_slice(&w, slice_new((const u8*)seed, seed_len));
    writer_write_u64(&w, lamports);
    writer_write_u64(&w, space);
    writer_write_address(&w, &owner);

    SolAccountMeta metas[3] = {
        {.pubkey = &from, .is_writable = true, .is_signer = true},
        {.pubkey = &to, .is_writable = true, .is_signer = false},
        {.pubkey = &base, .is_writable = false, .is_signer = true}
    };

    // System program ID
    address system_program_id = SYSTEM_PROGRAM_ID;

    // Create the instruction
    SolInstruction ix = {
        .program_id = &system_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data,
        .data_len = w.offset
    };

    const SolSignerSeeds seeds = {.addr = base_seeds, .len = base_seeds_len};

    // Execute the instruction
    context_invoke_signed(
        ctx, &ix, seeds, "System Create Account With Seed CPI failed"
    );
}

static void system_transfer(
    const Context* ctx, address from, address to, u64 lamports
) {
    // Allocate buffer for SolInstruction data
    u8 data[4 + 8]; // discriminator + lamports
    writer w = writer_new(data, sizeof(data));

    // Write SolInstruction data
    writer_write_u32(&w, 2); // discriminator (2 = Transfer)
    writer_write_u64(&w, lamports);

    SolAccountMeta metas[2] = {
        {.pubkey = &from, .is_writable = true, .is_signer = true},
        {.pubkey = &to, .is_writable = true, .is_signer = false}
    };

    address system_program_id = SYSTEM_PROGRAM_ID;
    const SolInstruction ix = {
        .program_id = &system_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data,
        .data_len = w.offset
    };

    context_invoke(ctx, &ix, "System Transfer CPI failed");
}

#endif
