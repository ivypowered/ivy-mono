#ifndef IVY_MIX_H
#define IVY_MIX_H

#include "game.h"
#include "safe_math.h"
#include "world.h"
#include "ivy-lib/packed.h"
#include <ivy-lib/ata.h>
#include <ivy-lib/context.h>
#include <ivy-lib/token.h>
#include <ivy-lib/types.h>

/** Functions to perform mixed swaps. */

// Jupiter Aggregator V6 address
static const address JUP_PROGRAM_ID = {
    .x = {4,   121, 213, 91,  242, 49,  192, 110, 238, 116, 197, 110, 206, 104, 21, 7,
          253, 177, 178, 222, 163, 244, 142, 81,  2,   177, 205, 162, 86,  188, 19, 143}
}; // JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
static const u64 JUP_IX_ROUTE_TAG = UINT64_C(0x2aade37a97cb17e5);
static const u64 JUP_IX_SHARED_ACCOUNTS_ROUTE_TAG = UINT64_C(0x819cd641339b20c1);

/// Safely patch a Jupiter instruction to change `in_amount` to the specified value.
static void jup_patch_in_amount(u8* jup_data, u64 jup_data_len, u64 in_amount) {
    require(jup_data_len >= sizeof(u64), "Jupiter data does not contain discriminator");
    u64 jup_discriminator = *(const u64*)jup_data;
    require(
        jup_discriminator == JUP_IX_ROUTE_TAG ||
            jup_discriminator == JUP_IX_SHARED_ACCOUNTS_ROUTE_TAG,
        "Jupiter instruction must be `route` or `shared_accounts_route`"
    );
    // `in_amount` is at offset -19 in `route` / `shared_accounts_route`
    require(jup_data_len >= 19, "Jupiter data too small; must be at least 19 bytes");
    *(u64*)(&jup_data[jup_data_len - 19]) = in_amount;
}

/// Safely patch a Jupiter instruction to disable slippage protection.
static void jup_patch_disable_slippage(u8* jup_data, u64 jup_data_len) {
    require(jup_data_len >= sizeof(u64), "Jupiter data does not contain discriminator");
    u64 jup_discriminator = *(const u64*)jup_data;
    require(
        jup_discriminator == JUP_IX_ROUTE_TAG ||
            jup_discriminator == JUP_IX_SHARED_ACCOUNTS_ROUTE_TAG,
        "Jupiter instruction must be `route` or `shared_accounts_route`"
    );
    // `quoted_out_amount` is at offset -11 in `route` / `shared_accounts_route`
    require(jup_data_len >= 11, "Jupiter data too small; must be at least 19 bytes");
    *(u64*)(&jup_data[jup_data_len - 11]) = 0; // expect nothing
    // `slippage_bps` is at offset -3 in `route` / `shared_accounts_route`
    *(u16*)(&jup_data[jup_data_len - 3]) = 0; // no slippage bps
}

/// Safely patch a Jupiter instruction to disable platform fees.
static void jup_patch_disable_platform_fees(u8* jup_data, u64 jup_data_len) {
    require(jup_data_len >= sizeof(u64), "Jupiter data does not contain discriminator");
    u64 jup_discriminator = *(const u64*)jup_data;
    require(
        jup_discriminator == JUP_IX_ROUTE_TAG ||
            jup_discriminator == JUP_IX_SHARED_ACCOUNTS_ROUTE_TAG,
        "Jupiter instruction must be `route` or `shared_accounts_route`"
    );
    // `platform_fee_bps` is at offset -1 in `route` / `shared_accounts_route`
    jup_data[jup_data_len - 1] = 0; // pin to zero :)
}

/// Get the index in the Jupiter account list of the destination token account.
static u64 jup_get_destination_token_account_index(
    const u8* jup_data, u64 jup_data_len
) {
    require(jup_data_len >= sizeof(u64), "Jupiter data does not contain discriminator");
    u64 jup_discriminator = *(const u64*)jup_data;
    switch (jup_discriminator) {
        case JUP_IX_ROUTE_TAG:
            return 3;
        case JUP_IX_SHARED_ACCOUNTS_ROUTE_TAG:
            return 6;
        default:
            require(
                false, "Jupiter instruction must be `route` or `shared_accounts_route`"
            );
            return 0;
    }
}

/// Call Jupiter with the provided accounts
static void jup_call(
    const Context* ctx,
    const SolAccountInfo* jup_accounts,
    u64 jup_accounts_len,
    u8* jup_data,
    u64 jup_data_len
) {
    // Prepare Jupiter account metas
    SolAccountMeta* jup_metas =
        (SolAccountMeta*)heap_alloc(sizeof(SolAccountMeta) * jup_accounts_len);
    for (u64 i = 0; i < jup_accounts_len; i++) {
        const SolAccountInfo* info = &jup_accounts[i];
        SolAccountMeta* meta = &jup_metas[i];
        meta->pubkey = info->key;
        meta->is_writable = info->is_writable;
        meta->is_signer = info->is_signer;
    }

    // Create and invoke the Jupiter instruction
    address jup_program_id = JUP_PROGRAM_ID;
    SolInstruction ix = (SolInstruction){.program_id = &jup_program_id,
                                         .accounts = jup_metas,
                                         .account_len = jup_accounts_len,
                                         .data = jup_data,
                                         .data_len = jup_data_len};
    context_invoke(ctx, &ix, "Error executing Jupiter program");
}

/* ------------------------------ */

// 19 accounts, leaving Jupiter with 45
// #idl instruction accounts mix_usdc_to_game
typedef struct {
    // #idl writable
    SolAccountInfo game;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo usdc_account;
    // #idl writable
    SolAccountInfo ivy_account;
    // #idl writable
    SolAccountInfo game_account;
    // #idl writable
    SolAccountInfo game_ivy_wallet;
    // #idl writable
    SolAccountInfo game_curve_wallet;
    // #idl writable
    SolAccountInfo game_treasury_wallet;
    // #idl writable
    SolAccountInfo ivy_mint;
    // #idl writable
    SolAccountInfo world;
    // #idl writable
    SolAccountInfo world_usdc_wallet;
    // #idl writable
    SolAccountInfo world_curve_wallet;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo game_mint;
    // #idl readonly
    SolAccountInfo ata_program;
    // #idl readonly
    SolAccountInfo system_program;
} MixUsdcToGameAccounts;

// #idl instruction discriminator mix_usdc_to_game
static const u64 MIX_USDC_TO_GAME_DISCRIMINATOR = UINT64_C(0xed79b7930664ca70);

// #idl instruction data mix_usdc_to_game
typedef struct packed {
    u64 usdc_amount;
    u64 game_threshold;
} MixUsdcToGameData;

/// Performs the swap USDC -> IVY -> GAME.
// #idl instruction declaration
static void mix_usdc_to_game(
    const Context* ctx,
    const MixUsdcToGameAccounts* accounts,
    const MixUsdcToGameData* data
) {
    SolAccountInfo ivy_account = accounts->ivy_account;

    // Step 1: Swap USDC to IVY using world_swap
    u64 starting_ivy_balance = token_get_balance(&ivy_account);
    {
        WorldSwapAccounts world_swap_accounts = {
            .world = accounts->world,
            .user = accounts->user,
            .source = accounts->usdc_account,
            .destination = ivy_account,
            .usdc_wallet = accounts->world_usdc_wallet,
            .curve_wallet = accounts->world_curve_wallet,
            .event_authority = accounts->event_authority,
            .destination_mint = accounts->ivy_mint,
            .this_program = accounts->this_program,
            .token_program = accounts->token_program,
            .ata_program = accounts->ata_program,
            .system_program = accounts->system_program,
        };

        WorldSwapData world_swap_data = {
            .amount = data->usdc_amount,
            // no slippage checks until the end
            .threshold = 0,
            .is_buy = true, // true = USDC -> IVY
            .create_dest = true
        };

        world_swap(ctx, &world_swap_accounts, &world_swap_data);

        // We have to refresh `ivy_account`'s data_len, which will
        // go from 0 to 165 on-chain if it didn't exist before `world_swap`
        // was called, otherwise token account access functions on
        // `ivy_account` will fail.
        sol_refresh_data_len(&ivy_account);
    }

    // Step 2: Swap IVY to GAME using game_swap
    u64 ending_ivy_balance = token_get_balance(&ivy_account);
    {
        GameSwapAccounts game_swap_accounts = {
            .game = accounts->game,
            .user = accounts->user,
            .source = ivy_account,
            .destination = accounts->game_account,
            .ivy_wallet = accounts->game_ivy_wallet,
            .curve_wallet = accounts->game_curve_wallet,
            .treasury_wallet = accounts->game_treasury_wallet,
            .world = accounts->world,
            .ivy_mint = accounts->ivy_mint,
            .game_mint = accounts->game_mint,
            .event_authority = accounts->event_authority,
            .this_program = accounts->this_program,
            .token_program = accounts->token_program,
            .ata_program = accounts->ata_program,
            .system_program = accounts->system_program,
        };

        GameSwapData game_swap_data = {
            // Swap all the IVY we just acquired
            .amount = safe_sub_64(ending_ivy_balance, starting_ivy_balance),
            .threshold = data->game_threshold,
            .is_buy = true, // true = IVY -> GAME
            .create_dest = true
        };

        game_swap(ctx, &game_swap_accounts, &game_swap_data);
    }
}

/* ------------------------------ */

// 20 accounts, leaving Jupiter with 44
// #idl instruction accounts mix_game_to_usdc
typedef struct {
    // #idl writable
    SolAccountInfo game;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo game_account;
    // #idl writable
    SolAccountInfo ivy_account;
    // #idl writable
    SolAccountInfo usdc_account;
    // #idl writable
    SolAccountInfo game_ivy_wallet;
    // #idl writable
    SolAccountInfo game_curve_wallet;
    // #idl writable
    SolAccountInfo game_treasury_wallet;
    // #idl writable
    SolAccountInfo ivy_mint;
    // #idl writable
    SolAccountInfo usdc_mint;
    // #idl writable
    SolAccountInfo world;
    // #idl writable
    SolAccountInfo world_usdc_wallet;
    // #idl writable
    SolAccountInfo world_curve_wallet;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo game_mint;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo ata_program;
    // #idl readonly
    SolAccountInfo system_program;
} MixGameToUsdcAccounts;

// #idl instruction discriminator mix_game_to_usdc
static const u64 MIX_GAME_TO_USDC_DISCRIMINATOR = UINT64_C(0x7c9b81c234b72e58);

// #idl instruction data mix_game_to_usdc
typedef struct {
    u64 game_amount;
    u64 usdc_threshold;
} MixGameToUsdcData;

/// Performs the swap GAME -> IVY -> USDC.
// #idl instruction declaration
static void mix_game_to_usdc(
    const Context* ctx,
    const MixGameToUsdcAccounts* accounts,
    const MixGameToUsdcData* data
) {
    SolAccountInfo ivy_account = accounts->ivy_account;

    // Step 1: Swap GAME to IVY using game_swap
    u64 starting_ivy_balance = token_get_balance(&ivy_account);
    {
        GameSwapAccounts game_swap_accounts = {
            .game = accounts->game,
            .user = accounts->user,
            .source = accounts->game_account,
            .destination = ivy_account,
            .ivy_wallet = accounts->game_ivy_wallet,
            .curve_wallet = accounts->game_curve_wallet,
            .treasury_wallet = accounts->game_treasury_wallet,
            .world = accounts->world,
            .ivy_mint = accounts->ivy_mint,
            .game_mint = accounts->game_mint,
            .event_authority = accounts->event_authority,
            .this_program = accounts->this_program,
            .token_program = accounts->token_program,
            .ata_program = accounts->ata_program,
            .system_program = accounts->system_program,
        };

        GameSwapData game_swap_data = {
            .amount = data->game_amount,
            // no slippage checks until the end
            .threshold = 0,
            .is_buy = false, // false = GAME -> IVY
            .create_dest = true,
        };

        game_swap(ctx, &game_swap_accounts, &game_swap_data);

        // We have to refresh `ivy_account`'s data_len, which will
        // go from 0 to 165 on-chain if it didn't exist before `world_swap`
        // was called, otherwise token account access functions on
        // `ivy_account` will fail.
        sol_refresh_data_len(&ivy_account);
    }

    // Step 2: Swap IVY to USDC using world_swap
    u64 ending_ivy_balance = token_get_balance(&ivy_account);
    {
        WorldSwapAccounts world_swap_accounts = {
            .world = accounts->world,
            .user = accounts->user,
            .source = ivy_account,
            .destination = accounts->usdc_account,
            .usdc_wallet = accounts->world_usdc_wallet,
            .curve_wallet = accounts->world_curve_wallet,
            .event_authority = accounts->event_authority,
            .destination_mint = accounts->usdc_mint,
            .this_program = accounts->this_program,
            .token_program = accounts->token_program,
            .ata_program = accounts->ata_program,
            .system_program = accounts->system_program
        };

        WorldSwapData world_swap_data = {
            // Swap all the IVY we just acquired
            .amount = safe_sub_64(ending_ivy_balance, starting_ivy_balance),
            .threshold = data->usdc_threshold,
            .is_buy = false, // false = IVY -> USDC
            .create_dest = true,
        };

        world_swap(ctx, &world_swap_accounts, &world_swap_data);
    }
}

/* ------------------------------ */

// #idl instruction accounts mix_any_to_game
typedef struct {
    // #idl reference MixUsdcToGameAccounts
    MixUsdcToGameAccounts utg_accounts;
    // must be followed by Jupiter accounts for the * -> USDC swap
} MixAnyToGameAccounts;

// #idl instruction discriminator mix_any_to_game
static const u64 MIX_ANY_TO_GAME_DISCRIMINATOR = UINT64_C(0x0b243faf1bf7de05);

// #idl instruction data mix_any_to_game
typedef struct {
    u64 game_threshold;
    // Jup data for the * -> USDC swap must follow
} MixAnyToGameData;

/// Performs the swap * -> USDC -> IVY -> GAME
// #idl instruction declaration
static void mix_any_to_game(const Context* ctx, const u8* data, u64 data_len) {
    require(
        data_len >= sizeof(MixAnyToGameData),
        "IX data too short to contain MixAnyToGameData"
    );
    MixAnyToGameData mtg_data = *(const MixAnyToGameData*)data;
    const u8* jup_data_const = &data[sizeof(MixAnyToGameData)];
    u64 jup_data_len = data_len - sizeof(MixAnyToGameData);
    require(jup_data_len > 0, "No Jup data provided");
    // For some reason, `SolInstruction.data` is non-const
    // We'll make a copy just to be safe
    u8* jup_data = (u8*)heap_alloc(jup_data_len);
    sol_memcpy(jup_data, jup_data_const, jup_data_len);

    // Fetch UTG + Jup accounts
    const u64 utg_accounts_len = sizeof(MixUsdcToGameAccounts) / sizeof(SolAccountInfo);
    require(
        ctx->ka_num >= utg_accounts_len,
        "Not enough accounts to deserialize into MixUsdcToGameAccounts"
    );
    MixUsdcToGameAccounts* utg_accounts = (MixUsdcToGameAccounts*)ctx->ka;
    const SolAccountInfo* jup_accounts = &ctx->ka[utg_accounts_len];
    u64 jup_accounts_len = ctx->ka_num - utg_accounts_len;

    // Get starting USDC balance
    u64 starting_usdc_balance = token_get_balance(&utg_accounts->usdc_account);

    // Call JUP to perform * -> USDC swap
    jup_patch_disable_slippage(jup_data, jup_data_len); // we do it at the end
    jup_patch_disable_platform_fees(jup_data, jup_data_len);
    jup_call(ctx, jup_accounts, jup_accounts_len, jup_data, jup_data_len);

    // Refresh USDC account `data_len` (which might have changed from 0 -> 165)
    sol_refresh_data_len(&utg_accounts->usdc_account);

    // Get ending USDC balance
    u64 ending_usdc_balance = token_get_balance(&utg_accounts->usdc_account);

    // Swap USDC -> IVY -> GAME
    MixUsdcToGameData utg_data = {
        .usdc_amount = safe_sub_64(ending_usdc_balance, starting_usdc_balance),
        .game_threshold = mtg_data.game_threshold,
    };
    mix_usdc_to_game(ctx, utg_accounts, &utg_data);
}

/* ------------------------------ */

// #idl instruction accounts mix_game_to_any
typedef struct {
    // #idl reference MixGameToUsdcAccounts
    MixGameToUsdcAccounts gtu_accounts;
    // must be followed by Jupiter accounts for the USDC -> * swap
} MixGameToAnyAccounts;

// #idl instruction discriminator mix_game_to_any
static const u64 MIX_GAME_TO_ANY_DISCRIMINATOR = UINT64_C(0x1b7f3c9a2d8e4051);

// #idl instruction data mix_game_to_any
typedef struct {
    u64 game_amount;
    u64 min_any_amount;
    // Jup data for the USDC -> * swap must follow
} MixGameToAnyData;

/// Performs the swap GAME -> IVY -> USDC -> *
// #idl instruction declaration
static void mix_game_to_any(const Context* ctx, const u8* data, u64 data_len) {
    require(
        data_len >= sizeof(MixGameToAnyData),
        "IX data too short to contain MixGameToAnyData"
    );
    MixGameToAnyData mga_data = *(const MixGameToAnyData*)data;
    const u8* jup_data_const = &data[sizeof(MixGameToAnyData)];
    u64 jup_data_len = data_len - sizeof(MixGameToAnyData);
    require(jup_data_len > 0, "No Jup data provided");
    // Make a mutable copy of Jup data to patch later
    u8* jup_data = (u8*)heap_alloc(jup_data_len);
    sol_memcpy(jup_data, jup_data_const, jup_data_len);

    // Fetch GTU + Jup accounts
    const u64 gtu_accounts_len = sizeof(MixGameToUsdcAccounts) / sizeof(SolAccountInfo);
    require(
        ctx->ka_num >= gtu_accounts_len,
        "Not enough accounts to deserialize into MixGameToUsdcAccounts"
    );
    MixGameToUsdcAccounts* gtu_accounts = (MixGameToUsdcAccounts*)ctx->ka;
    const SolAccountInfo* jup_accounts = &ctx->ka[gtu_accounts_len];
    u64 jup_accounts_len = ctx->ka_num - gtu_accounts_len;

    // Step 1: Swap GAME -> IVY -> USDC
    MixGameToUsdcData gtu_data = {
        .game_amount = mga_data.game_amount,
        // Jupiter performs slippage check
        .usdc_threshold = 0,
    };
    // Get starting balance
    u64 starting_usdc_balance = token_get_balance(&gtu_accounts->usdc_account);
    // Perform the swap. USDC will end up in gtu_accounts->usdc_account
    mix_game_to_usdc(ctx, gtu_accounts, &gtu_data);
    // Refresh the USDC account `data_len` (which might have gone from 0 -> 165)
    sol_refresh_data_len(&gtu_accounts->usdc_account);
    // Get ending balance
    u64 ending_usdc_balance = token_get_balance(&gtu_accounts->usdc_account);

    // Step 2: Patch Jupiter IX data
    jup_patch_in_amount(
        /* jup_data */ jup_data,
        /* jup_data_len */ jup_data_len,
        /* in_amount */ safe_sub_64(ending_usdc_balance, starting_usdc_balance)
    );
    jup_patch_disable_slippage(jup_data, jup_data_len);
    jup_patch_disable_platform_fees(jup_data, jup_data_len);

    // Step 3: Call JUP to perform USDC -> * swap
    SolAccountInfo* any_account = context_get_account(
        ctx,
        (sizeof(MixGameToAnyAccounts) / sizeof(SolAccountInfo)) +
            jup_get_destination_token_account_index(jup_data, jup_data_len)
    );
    u64 any_before = token_get_balance(any_account);
    jup_call(ctx, jup_accounts, jup_accounts_len, jup_data, jup_data_len);
    sol_refresh_data_len(any_account);
    u64 any_after = token_get_balance(any_account);
    u64 any_amount = safe_sub_64(any_after, any_before);
    require(any_amount >= mga_data.min_any_amount, "Slippage tolerance exceeded");
}

/* ------------------------------ */

// #idl instruction accounts mix_any_to_ivy
typedef struct {
    // #idl writable
    SolAccountInfo world;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo usdc_account;
    // #idl writable
    SolAccountInfo ivy_account;
    // #idl writable
    SolAccountInfo world_usdc_wallet;
    // #idl writable
    SolAccountInfo world_curve_wallet;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo ivy_mint;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo ata_program;
    // #idl readonly
    SolAccountInfo system_program;
    // must be followed by Jupiter accounts for the * -> USDC swap
} MixAnyToIvyAccounts;

// #idl instruction discriminator mix_any_to_ivy
static const u64 MIX_ANY_TO_IVY_DISCRIMINATOR = UINT64_C(0x3a61c3f4f2ec5d1b);

// #idl instruction data mix_any_to_ivy
typedef struct {
    u64 ivy_threshold;
    // Jup data for the * -> USDC swap must follow
} MixAnyToIvyData;

/// Performs the swap * -> USDC -> IVY
// #idl instruction declaration
static void mix_any_to_ivy(const Context* ctx, const u8* data, u64 data_len) {
    require(
        data_len >= sizeof(MixAnyToIvyData),
        "IX data too short to contain MixAnyToIvyData"
    );
    MixAnyToIvyData mti_data = *(const MixAnyToIvyData*)data;
    const u8* jup_data_const = &data[sizeof(MixAnyToIvyData)];
    u64 jup_data_len = data_len - sizeof(MixAnyToIvyData);
    require(jup_data_len > 0, "No Jup data provided");
    // For some reason, `SolInstruction.data` is non-const
    // We'll make a copy just to be safe
    u8* jup_data = (u8*)heap_alloc(jup_data_len);
    sol_memcpy(jup_data, jup_data_const, jup_data_len);

    // Fetch accounts
    const u64 base_accounts_len = sizeof(MixAnyToIvyAccounts) / sizeof(SolAccountInfo);
    require(
        ctx->ka_num >= base_accounts_len,
        "Not enough accounts to deserialize into MixAnyToIvyAccounts"
    );
    MixAnyToIvyAccounts* base_accounts = (MixAnyToIvyAccounts*)ctx->ka;
    const SolAccountInfo* jup_accounts = &ctx->ka[base_accounts_len];
    u64 jup_accounts_len = ctx->ka_num - base_accounts_len;

    // Get starting USDC balance
    u64 starting_usdc_balance = token_get_balance(&base_accounts->usdc_account);

    // Call JUP to perform * -> USDC swap
    jup_patch_disable_slippage(jup_data, jup_data_len); // we do it at the end
    jup_patch_disable_platform_fees(jup_data, jup_data_len);
    jup_call(ctx, jup_accounts, jup_accounts_len, jup_data, jup_data_len);

    // Refresh USDC account `data_len`, which might have gone from 0 -> 165
    sol_refresh_data_len(&base_accounts->usdc_account);

    // Get ending USDC balance
    u64 ending_usdc_balance = token_get_balance(&base_accounts->usdc_account);
    u64 usdc_amount = safe_sub_64(ending_usdc_balance, starting_usdc_balance);

    // Step 2: Swap USDC to IVY using world_swap
    WorldSwapAccounts world_swap_accounts = {
        .world = base_accounts->world,
        .user = base_accounts->user,
        .source = base_accounts->usdc_account,
        .destination = base_accounts->ivy_account,
        .usdc_wallet = base_accounts->world_usdc_wallet,
        .curve_wallet = base_accounts->world_curve_wallet,
        .event_authority = base_accounts->event_authority,
        .destination_mint = base_accounts->ivy_mint,
        .this_program = base_accounts->this_program,
        .token_program = base_accounts->token_program,
        .ata_program = base_accounts->ata_program,
        .system_program = base_accounts->system_program,
    };

    WorldSwapData world_swap_data = {
        .amount = usdc_amount,
        .threshold = mti_data.ivy_threshold,
        .is_buy = true, // true = USDC -> IVY
        .create_dest = true,
    };

    world_swap(ctx, &world_swap_accounts, &world_swap_data);
}

/* ------------------------------ */

// #idl instruction accounts mix_ivy_to_any
typedef struct {
    // #idl writable
    SolAccountInfo world;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo ivy_account;
    // #idl writable
    SolAccountInfo usdc_account;
    // #idl writable
    SolAccountInfo world_usdc_wallet;
    // #idl writable
    SolAccountInfo world_curve_wallet;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo usdc_mint;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo ata_program;
    // #idl readonly
    SolAccountInfo system_program;
    // must be followed by Jupiter accounts for the USDC -> * swap
} MixIvyToAnyAccounts;

// #idl instruction discriminator mix_ivy_to_any
static const u64 MIX_IVY_TO_ANY_DISCRIMINATOR = UINT64_C(0x2f8a2e718bf6c149);

// #idl instruction data mix_ivy_to_any
typedef struct {
    u64 ivy_amount;
    u64 min_any_amount;
    // Jup data for the USDC -> * swap must follow
} MixIvyToAnyData;

/// Performs the swap IVY -> USDC -> *
// #idl instruction declaration
static void mix_ivy_to_any(const Context* ctx, const u8* data, u64 data_len) {
    require(
        data_len >= sizeof(MixIvyToAnyData),
        "IX data too short to contain MixIvyToAnyData"
    );
    MixIvyToAnyData mia_data = *(const MixIvyToAnyData*)data;
    const u8* jup_data_const = &data[sizeof(MixIvyToAnyData)];
    u64 jup_data_len = data_len - sizeof(MixIvyToAnyData);
    require(jup_data_len > 0, "No Jup data provided");
    // Make a mutable copy of Jup data to patch later
    u8* jup_data = (u8*)heap_alloc(jup_data_len);
    sol_memcpy(jup_data, jup_data_const, jup_data_len);

    // Fetch accounts
    const u64 base_accounts_len = sizeof(MixIvyToAnyAccounts) / sizeof(SolAccountInfo);
    require(
        ctx->ka_num >= base_accounts_len,
        "Not enough accounts to deserialize into MixIvyToAnyAccounts"
    );
    MixIvyToAnyAccounts* base_accounts = (MixIvyToAnyAccounts*)ctx->ka;
    const SolAccountInfo* jup_accounts = &ctx->ka[base_accounts_len];
    u64 jup_accounts_len = ctx->ka_num - base_accounts_len;

    // Step 1: Swap IVY to USDC using world_swap
    // Get starting USDC balance
    u64 starting_usdc_balance = token_get_balance(&base_accounts->usdc_account);

    WorldSwapAccounts world_swap_accounts = {
        .world = base_accounts->world,
        .user = base_accounts->user,
        .source = base_accounts->ivy_account,
        .destination = base_accounts->usdc_account,
        .usdc_wallet = base_accounts->world_usdc_wallet,
        .curve_wallet = base_accounts->world_curve_wallet,
        .event_authority = base_accounts->event_authority,
        .destination_mint = base_accounts->usdc_mint,
        .this_program = base_accounts->this_program,
        .token_program = base_accounts->token_program,
        .ata_program = base_accounts->ata_program,
        .system_program = base_accounts->system_program
    };

    WorldSwapData world_swap_data = {
        .amount = mia_data.ivy_amount,
        // We perform slippage check at the end
        .threshold = 0,
        .is_buy = false, // false = IVY -> USDC
        .create_dest = true
    };

    world_swap(ctx, &world_swap_accounts, &world_swap_data);

    // Refresh usdc_account's data_len (which might have gone 0 -> 165)
    sol_refresh_data_len(&base_accounts->usdc_account);

    // Get ending USDC balance
    u64 ending_usdc_balance = token_get_balance(&base_accounts->usdc_account);

    // Step 2: Patch Jupiter IX data
    jup_patch_in_amount(
        /* jup_data */ jup_data,
        /* jup_data_len */ jup_data_len,
        /* in_amount */ safe_sub_64(ending_usdc_balance, starting_usdc_balance)
    );
    jup_patch_disable_slippage(jup_data, jup_data_len);
    jup_patch_disable_platform_fees(jup_data, jup_data_len);

    // Step 3: Call JUP to perform USDC -> * swap
    SolAccountInfo* any_account = context_get_account(
        ctx,
        (sizeof(MixIvyToAnyAccounts) / sizeof(SolAccountInfo)) +
            jup_get_destination_token_account_index(jup_data, jup_data_len)
    );
    u64 any_before = token_get_balance(any_account);
    jup_call(ctx, jup_accounts, jup_accounts_len, jup_data, jup_data_len);
    sol_refresh_data_len(any_account);
    u64 any_after = token_get_balance(any_account);
    u64 any_amount = safe_sub_64(any_after, any_before);
    require(any_amount >= mia_data.min_any_amount, "Slippage tolerance exceeded");
}

#endif // IVY_MIX_H
