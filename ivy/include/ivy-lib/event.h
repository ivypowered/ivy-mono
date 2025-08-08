#ifndef IVY_LIB_EVENT_H
#define IVY_LIB_EVENT_H

#include "context.h"
#include "rw.h"

static const char* const EVENT_AUTHORITY_PREFIX = "__event_authority";
static const u64 EVENT_IX_TAG = UINT64_C(0x1d9acb512ea545e4); // per anchor

/// Derives the program's event authority.
static ProgramDerivedAddress event_derive_authority(address program_id) {
    const slice seeds[1] = {slice_from_str(EVENT_AUTHORITY_PREFIX)};

    return find_program_address(
        /* seeds */ seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(seeds),
        /* program_id */ program_id,
        /* msg */ "Can't find event authority address"
    );
}

/// Verifies the provided event.
/// If the instruction's tag is `EVENT_IX_TAG`, this function
/// or an equivalent MUST be called at least once in the call stack.
static void event_verify(
    const SolAccountInfo* provided_event_authority, address actual_event_authority
) {
    require(
        address_equal(provided_event_authority->key, &actual_event_authority) &&
            provided_event_authority->is_signer,
        "Cannot emit event: invalid event authority provided"
    );
}

/// Emits the provided event.
static void event_emit(
    const Context* ctx,
    slice evt_data,
    address global_address,
    address event_authority,
    u8 event_authority_nonce
) {
    // Prepare instruction data: 8 bytes tag + event data
    u64 data_len = 8 + evt_data.len;
    u8* instruction_data = (u8*)heap_alloc(data_len);

    writer w = writer_new(instruction_data, data_len);
    writer_write_u64(&w, EVENT_IX_TAG);
    writer_write_slice(&w, evt_data);

    SolAccountMeta metas[2] = {
        {.pubkey = &global_address, .is_writable = false, .is_signer = false},
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

#endif
