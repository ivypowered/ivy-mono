#ifndef IVY_UTIL_H
#define IVY_UTIL_H

#include <ivy-lib/alt.h>
#include <ivy-lib/heap.h>
#include <ivy-lib/rw.h>
#include <ivy-lib/types.h>
#include <solana_sdk.h>

// === Functions ===

static void authorize(const SolAccountInfo* provided, address desired) {
    require(
        address_equal(provided->key, &desired) && provided->is_signer, "Unauthorized"
    );
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
