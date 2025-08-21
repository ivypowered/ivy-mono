#ifndef IVY_LIB_CONTEXT_H
#define IVY_LIB_CONTEXT_H

#include "heap.h"
#include "types.h"
#include <solana_sdk.h>

typedef struct {
    /// Array of SolAccountInfos
    SolAccountInfo* ka;
    /// Number of entries in `ka`
    u64 ka_num;
    /// Array of unique (non-duplicate) SolAccountInfos
    /// To be used for CPI
    SolAccountInfo* ka_unique;
    /// Number of entries in `ka_unique`
    u64 ka_unique_num;
    /// Pointer to the instruction data
    const u8* data;
    /// Length (in bytes) of the instruction data
    u64 data_len;
    /// Address of the currently executing program
    const address* program_id;
} Context;

/// Solana allows programs to lock 64 unique accounts per
/// transaction. However, programs can be passed up to 255
/// non-unique accounts. This is the theoretical maximum,
/// as `dup_info`, which acts as an index for duplicate accounts,
/// is a `u8` where a value of `255` means that the account is
/// not a duplicate and anything less means that the account is
/// a duplicate of the account at index `dup_info`.
static const u64 MAX_ACCOUNTS = 255;

/// Load the input into the context
/// Adapted from `sol_deserialize`
static Context context_load(const u8* input) {
    require(input != NULL, "Input is NULL");

    // Get number of accounts
    u64 ka_num = *(u64*)input;
    require(ka_num < MAX_ACCOUNTS, "Account limit reached");
    input += sizeof(u64);

    // Allocate account info array
    SolAccountInfo* ka = (SolAccountInfo*)heap_alloc(sizeof(SolAccountInfo) * ka_num);

    // Track unique accounts during deserialization
    u64 unique_count = 0;
    SolAccountInfo* unique_accounts[MAX_ACCOUNTS];

    // First pass: deserialize accounts and count unique ones
    for (u64 i = 0; i < ka_num; i++) {
        u8 dup_info = input[0];
        input += sizeof(u8);

        if (dup_info == UINT8_MAX) {
            // This is a unique account
            // is signer?
            ka[i].is_signer = *(u8*)input != 0;
            input += sizeof(u8);

            // is writable?
            ka[i].is_writable = *(u8*)input != 0;
            input += sizeof(u8);

            // executable?
            ka[i].executable = *(u8*)input;
            input += sizeof(u8);

            input += 4; // padding

            // key
            ka[i].key = (SolPubkey*)input;
            input += sizeof(SolPubkey);

            // owner
            ka[i].owner = (SolPubkey*)input;
            input += sizeof(SolPubkey);

            // lamports
            ka[i].lamports = (u64*)input;
            input += sizeof(u64);

            // account data
            ka[i].data_len = *(u64*)input;
            input += sizeof(u64);
            ka[i].data = (u8*)input;
            input += ka[i].data_len;
            input += MAX_PERMITTED_DATA_INCREASE;
            input = (u8*)(((u64)input + 7) & ~7); // padding

            // rent epoch
            ka[i].rent_epoch = *(u64*)input;
            input += sizeof(u64);

            // Add to unique accounts array
            unique_accounts[unique_count++] = &ka[i];
        } else {
            // This is a duplicate account
            require(dup_info < i, "Invalid duplicate info");
            ka[i] = ka[dup_info];
            input += 7; // padding
        }
    }

    // Instruction data
    u64 data_len = *(u64*)input;
    input += sizeof(u64);
    const u8* data = input;
    input += data_len;

    // Program ID
    const address* program_id = (const address*)input;

    // Create unique account array
    SolAccountInfo* ka_unique =
        (SolAccountInfo*)heap_alloc(sizeof(SolAccountInfo) * unique_count);
    for (u64 i = 0; i < unique_count; i++) {
        ka_unique[i] = *unique_accounts[i];
    }

    // Create and return context object
    return (Context){.ka = ka,
                     .ka_num = ka_num,
                     .ka_unique = ka_unique,
                     .ka_unique_num = unique_count,
                     .data = data,
                     .data_len = data_len,
                     .program_id = program_id};
}

/// Invoke a CPI
static void context_invoke(
    const Context* ctx, const SolInstruction* ix, const char* msg
) {
    require(sol_invoke(ix, ctx->ka_unique, ctx->ka_unique_num) == SUCCESS, msg);
}

// Invoke a CPI with signer seeds
static void context_invoke_signed(
    const Context* ctx, const SolInstruction* ix, SolSignerSeeds seeds, const char* msg
) {
    require(
        sol_invoke_signed(ix, ctx->ka_unique, ctx->ka_unique_num, &seeds, 1) == SUCCESS,
        msg
    );
}

// Safely get an account at the given index
static SolAccountInfo* context_get_account(const Context* ctx, u64 index) {
    require(
        index < ctx->ka_num, "Invalid account index passed to `context_get_account`"
    );
    return &ctx->ka[index];
}

#endif // IVY_CONTEXT_H
