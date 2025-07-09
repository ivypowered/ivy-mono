#ifndef IVY_UTIL_H
#define IVY_UTIL_H

#include "lib/alt.h"
#include "lib/heap.h"
#include "lib/rw.h"
#include "lib/types.h"
#include <solana_sdk.h>

// === Constants ===

static const char* const EVENT_AUTHORITY_PREFIX = "__event_authority";
static const u64 EVENT_IX_TAG = 0x1d9acb512ea545e4; // per anchor

// === Functions ===

static void authorize(const SolAccountInfo* provided, address desired) {
    require(
        address_equal(provided->key, &desired) && provided->is_signer, "Unauthorized"
    );
}

static ProgramDerivedAddress derive_event_authority(address program_id) {
    const slice seeds[1] = {slice_from_str(EVENT_AUTHORITY_PREFIX)};

    return find_program_address(
        /* seeds */ seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(seeds),
        /* program_id */ program_id,
        /* msg */ "Can't find event authority address"
    );
}

static void emit_event(
    const Context* ctx,
    slice event_data,
    address data_address,
    address event_authority,
    u8 event_authority_nonce
) {
    // Prepare instruction data: 8 bytes tag + event data
    u64 data_len = 8 + event_data.len;
    u8* instruction_data = (u8*)heap_alloc(data_len);

    writer w = writer_new(instruction_data, data_len);
    writer_write_u64(&w, EVENT_IX_TAG);
    writer_write_slice(&w, event_data);

    SolAccountMeta metas[2] = {
        {.pubkey = &data_address, .is_writable = false, .is_signer = false},
        {.pubkey = &event_authority, .is_writable = false, .is_signer = true}
    };

    address program_id = *ctx->program_id;
    const SolInstruction instruction = {
        .program_id = &program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = instruction_data,
        .data_len = w.offset
    };

    // Prepare seeds for signing
    u8 nonce_bytes[1] = {event_authority_nonce};
    const slice seeds[2] = {
        slice_from_str(EVENT_AUTHORITY_PREFIX), slice_new(nonce_bytes, 1)
    };
    const SolSignerSeeds signers_seeds = {.addr = seeds, .len = 2};

    context_invoke_signed(ctx, &instruction, signers_seeds, "Could not invoke event");
}

/// Set up an Address Lookup Table
static void setup_alt(
    const Context* ctx,
    address lookup_table,
    address authority,
    address payer,
    const address* entries,
    u64 entries_len,
    u64 recent_slot,
    u8 bump_seed,
    const slice* authority_seeds,
    u64 authority_seeds_len
) {
    // (a) Create the lookup table
    alt_create(
        /* ctx */ ctx,
        /* lookup_table_address */ lookup_table,
        /* authority_address */ authority,
        /* payer_address */ payer,
        /* recent_slot */ recent_slot,
        /* bump_seed */ bump_seed
    );

    // (b) Extend it with entries
    alt_extend_signed(
        /* ctx */ ctx,
        /* lookup_table_address */ lookup_table,
        /* authority_address */ authority,
        /* payer_address */ payer,
        /* new_addresses */ entries,
        /* new_addresses_len */ entries_len,
        /* authority_seeds */ authority_seeds,
        /* authority_seeds_len */ authority_seeds_len
    );

    // (c) Freeze it to prevent any more updates
    alt_freeze_signed(
        /* ctx */ ctx,
        /* lookup_table_address */ lookup_table,
        /* authority_address */ authority,
        /* authority_seeds */ authority_seeds,
        /* authority_seeds_len */ authority_seeds_len
    );
}

// Extract the amount field from a 32-byte identifier
// It's serialized as a little-endian u64 in the last 8
// bytes
static u64 id_extract_amount(bytes32 id) {
    return *(u64*)(&id.x[24]);
}

#endif // IVY_UTIL_H
