#ifndef IVY_CONTEXT_H
#define IVY_CONTEXT_H

#include "heap.h"
#include "types.h"
#include <solana_sdk.h>

typedef SolParameters Context;

/// Only support up to 64 accounts,
/// maximum allowed by Solana runtime
/// as of 6 April 2025
static const u64 MAX_ACCOUNTS = 64;

static Context context_load(const u8* input) {
    // Allocate context
    SolAccountInfo* infos =
        (SolAccountInfo*)heap_alloc(sizeof(SolAccountInfo) * MAX_ACCOUNTS);
    Context ctx = (Context){.ka = infos};

    // Deserialize input
    require(sol_deserialize(input, &ctx, MAX_ACCOUNTS), "Can't deserialize input");

    // sol_deserialize will set params.ka_num
    // to total # of accounts, not total #
    // of deserialized accounts, so this check
    // is necessary.
    require(ctx.ka_num < MAX_ACCOUNTS, "Account limit reached");
    return ctx;
}

#endif
