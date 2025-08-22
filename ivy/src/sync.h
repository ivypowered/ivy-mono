#ifndef IVY_SYNC_H
#define IVY_SYNC_H

#include "cp_curve.h"
#include "safe_math.h"
#include "world.h"
#include "ivy-lib/packed.h"
#include <ivy-lib/ata.h>
#include <ivy-lib/context.h>
#include <ivy-lib/metadata.h>
#include <ivy-lib/pswap.h>
#include <ivy-lib/pump.h>
#include <ivy-lib/rw.h>
#include <ivy-lib/system.h>
#include <ivy-lib/token.h>
#include <ivy-lib/types.h>
#include <ivy-lib/utf8.h>

// === Constants ===

static const char* const SYNC_PREFIX = "sync";
static const char* const SYNC_MINT_PREFIX = "sync_mint";
static const char* const SYNC_SYNC_WALLET_PREFIX = "sync_sync_wallet";
static const char* const SYNC_PUMP_WALLET_PREFIX = "sync_pump_wallet";

// Pump.fun has 6 decimals. We'll use 9 instead. This shrinks our token supply
// by a factor of 1,000, and makes the price 1,000x more. Coins will start
// at a price of, say, ~$0.0006, and bond at say ~$0.05.
static const u64 SYNC_DECIMALS = 9;
// 1 billion tokens with 6 decimals (Pump.fun),
// or 1 million tokens with 9 decimals (us!)
static const u64 SYNC_MAX_SUPPLY = UINT64_C(1000000000000000);

// Fee configuration
static const u64 SYNC_FEE_BPS = 75; // 0.75% fee on all swaps
static const address SYNC_BENEFICIARY = {
    .x = {// EGTNw9v8SKJexnjGsiD6bRoGEAm2iMYAXjHrYU9SX1iP
          197, 29,  119, 211, 64, 125, 168, 150, 225, 136, 9,   110, 250, 126, 213, 58,
          133, 156, 183, 153, 69, 214, 36,  92,  205, 37,  130, 45,  41,  89,  20,  224
    }
};

// === Events ===

// #idl event declaration
typedef struct {
    u64 discriminator;
    address sync;
    address pump_mint;
    // #idl strings name symbol metadata_url game_url
    u8 strdata[];
} SyncCreateEvent;

// #idl event discriminator SyncCreateEvent
static const u64 SYNC_CREATE_EVENT_DISCRIMINATOR = UINT64_C(0x6b6c1f15defe797f);

// #idl event declaration
typedef struct {
    u64 discriminator;
    address sync;
    address user;
    u64 sol_amount;
    u64 token_amount;
    bool is_buy;
    bool is_pswap;
} SyncSwapEvent;

// #idl event discriminator SyncSwapEvent
static const u64 SYNC_SWAP_EVENT_DISCRIMINATOR = UINT64_C(0x61f7837aceb6bb53);

// === State ===

// #idl struct declaration
typedef struct {
    u64 discriminator;

    // Creation seed for PDA derivations
    bytes32 seed;

    // The Pump.fun mint being mirrored
    address pump_mint;

    // The sync mint we create and fully pre-mint
    address sync_mint;

    // Program wallets (PDAs) that custody inventory:
    // - sync_wallet holds the entire sync token supply
    // - pump_wallet accumulates mirrored Pump.fun tokens
    address sync_wallet;
    address pump_wallet;
} Sync;

// #idl struct discriminator Sync
static const u64 SYNC_DISCRIMINATOR = UINT64_C(0x6f7f1193b3c2d4e5);

static Sync* sync_load(const Context* ctx, const SolAccountInfo* sync_acc) {
    require(
        address_equal(ctx->program_id, sync_acc->owner), "Incorrect Sync account owner"
    );
    require(sync_acc->data_len >= sizeof(Sync), "Provided Sync account data too small");
    Sync* s = (Sync*)sync_acc->data;
    require(
        s->discriminator == SYNC_DISCRIMINATOR, "Provided Sync discriminator incorrect"
    );
    return s;
}

static bool sync_is_valid(const Context* ctx, const SolAccountInfo* sync) {
    return address_equal(ctx->program_id, sync->owner) &&
        sync->data_len >= sizeof(Sync) &&
        ((const Sync*)sync->data)->discriminator == SYNC_DISCRIMINATOR;
}

/* ------------------------------ */

// #idl instruction accounts sync_create
typedef struct {
    // #idl writable
    SolAccountInfo sync;
    // #idl signer
    SolAccountInfo user;

    // Pump.fun mint we mirror
    // #idl readonly
    SolAccountInfo pump_mint;

    // Metadata PDA for the sync mint
    // #idl writable
    SolAccountInfo metadata;

    // PDAs that will be created by this instruction
    // #idl writable
    SolAccountInfo sync_mint;
    // #idl writable
    SolAccountInfo sync_wallet;
    // #idl writable
    SolAccountInfo pump_wallet;

    // Programs
    // #idl readonly
    SolAccountInfo metadata_program;
    // #idl readonly
    SolAccountInfo system_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo ata_program;

    // #idl readonly
    SolAccountInfo world;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
} SyncCreateAccounts;

// #idl instruction data sync_create
typedef struct {
    bytes32 seed;
    // #idl strings name symbol metadata_url game_url
    u8 str_params[];
} SyncCreateData;

// #idl instruction discriminator sync_create
static const u64 SYNC_CREATE_DISCRIMINATOR = UINT64_C(0xda49f184791ceb1a);

// #idl instruction declaration
static void sync_create(
    const Context* ctx,
    const SyncCreateAccounts* accounts,
    const SyncCreateData* data,
    u64 data_len
) {
    // Parse strings
    reader r = reader_new(
        data->str_params, safe_sub_64(data_len, offsetof(SyncCreateData, str_params))
    );
    slice name = reader_read_anchor_string_borrowed(&r);
    slice symbol = reader_read_anchor_string_borrowed(&r);
    slice metadata_url = reader_read_anchor_string_borrowed(&r);
    require(metadata_url.len > 0, "Metadata URL required");
    slice game_url = reader_read_anchor_string_borrowed(&r);

    // Validate UTF-8
    require(utf8_validate(name.addr, name.len), "name is not valid UTF-8");
    require(utf8_validate(symbol.addr, symbol.len), "symbol is not valid UTF-8");
    require(
        utf8_validate(metadata_url.addr, metadata_url.len),
        "metadata URL is not valid UTF-8"
    );
    require(utf8_validate(game_url.addr, game_url.len), "game URL is not valid UTF-8");

    // Derive Sync PDA
    slice sync_seeds[2] = {
        slice_from_str(SYNC_PREFIX), slice_from_bytes32(&data->seed)
    };
    address sync_addr = create_program_address(
        sync_seeds,
        SOL_ARRAY_SIZE(sync_seeds),
        *ctx->program_id,
        "Can't create sync program address"
    );
    require(address_equal(accounts->sync.key, &sync_addr), "Incorrect sync address");

    // Create sync state account
    system_create_account(
        ctx,
        /* destination */ sync_addr,
        /* payer */ *accounts->user.key,
        /* owner */ *ctx->program_id,
        /* size */ sizeof(Sync),
        /* seeds */ sync_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(sync_seeds)
    );

    // Initialize state
    Sync* s = (Sync*)accounts->sync.data;
    s->discriminator = SYNC_DISCRIMINATOR;
    s->seed = data->seed;
    s->pump_mint = *accounts->pump_mint.key;

    // Derive and create sync mint
    slice mint_seeds[2] = {
        slice_from_str(SYNC_MINT_PREFIX), slice_from_address(&sync_addr)
    };
    address sync_mint = create_program_address(
        mint_seeds,
        SOL_ARRAY_SIZE(mint_seeds),
        *ctx->program_id,
        "Can't create sync mint program address"
    );
    require(
        address_equal(accounts->sync_mint.key, &sync_mint),
        "Incorrect sync mint address"
    );
    s->sync_mint = sync_mint;

    token_create_mint(
        ctx,
        /* payer */ *accounts->user.key,
        /* mint_address */ sync_mint,
        /* mint_authority */ *accounts->user.key, // temporary
        /* freeze_authority */ ADDRESS_ZERO,
        /* mint_seeds */ mint_seeds,
        /* mint_seeds_len */ SOL_ARRAY_SIZE(mint_seeds),
        /* decimals */ SYNC_DECIMALS
    );

    // Derive and create sync wallet (custody for entire supply)
    slice sync_wallet_seeds[2] = {
        slice_from_str(SYNC_SYNC_WALLET_PREFIX), slice_from_address(&sync_addr)
    };
    address sync_wallet = create_program_address(
        sync_wallet_seeds,
        SOL_ARRAY_SIZE(sync_wallet_seeds),
        *ctx->program_id,
        "Can't create sync wallet program address"
    );
    require(
        address_equal(accounts->sync_wallet.key, &sync_wallet),
        "Incorrect sync wallet address"
    );
    s->sync_wallet = sync_wallet;

    token_create_account(
        ctx,
        /* payer */ *accounts->user.key,
        /* token_account */ sync_wallet,
        /* mint_address */ sync_mint,
        /* owner */ sync_wallet,
        /* token_account_seeds */ sync_wallet_seeds,
        /* token_account_seeds_len */ SOL_ARRAY_SIZE(sync_wallet_seeds)
    );

    // Mint full supply to sync wallet
    token_mint(
        ctx,
        /* mint_address */ sync_mint,
        /* mint_authority */ *accounts->user.key,
        /* destination */ sync_wallet,
        /* amount */ SYNC_MAX_SUPPLY
    );

    // Derive and create pump wallet (custody of mirrored Pump.fun tokens)
    slice pump_wallet_seeds[2] = {
        slice_from_str(SYNC_PUMP_WALLET_PREFIX), slice_from_address(&sync_addr)
    };
    address pump_wallet = create_program_address(
        pump_wallet_seeds,
        SOL_ARRAY_SIZE(pump_wallet_seeds),
        *ctx->program_id,
        "Can't create pump wallet program address"
    );
    require(
        address_equal(accounts->pump_wallet.key, &pump_wallet),
        "Incorrect pump wallet address"
    );
    s->pump_wallet = pump_wallet;

    token_create_account(
        ctx,
        /* payer */ *accounts->user.key,
        /* token_account */ pump_wallet,
        /* mint_address */ *accounts->pump_mint.key,
        /* owner */ pump_wallet,
        /* token_account_seeds */ pump_wallet_seeds,
        /* token_account_seeds_len */ SOL_ARRAY_SIZE(pump_wallet_seeds)
    );

    // Create metadata for sync mint (sync PDA is update authority)
    MetadataDataV2 md = {.name = name, .symbol = symbol, .uri = metadata_url};
    metadata_create(
        ctx,
        /* metadata_address */ *accounts->metadata.key,
        /* mint */ sync_mint,
        /* mint_authority */ *accounts->user.key,
        /* update_authority */ sync_addr,
        /* payer */ *accounts->user.key,
        /* data */ &md
    );

    // Permanently revoke mint authority
    token_set_authority(
        ctx,
        /* mint_or_token_account */ sync_mint,
        /* kind */ TOKEN_AUTHORITY_MINT_TOKENS,
        /* authority */ *accounts->user.key,
        /* new_authority */ ADDRESS_ZERO
    );

    // Load world to get event authority
    const World* world = world_load(ctx, &accounts->world);

    // Emit create event
    u64 create_event_len = offsetof(SyncCreateEvent, strdata) + 4 +
        name.len + // name length (u32) + name (bytes)
        4 + symbol.len + // symbol length (u32) + symbol (bytes)
        4 + metadata_url.len + // metadata_url length (u32) + metadata_url (bytes)
        4 + game_url.len;

    SyncCreateEvent* create_event = heap_alloc(create_event_len);
    create_event->discriminator = SYNC_CREATE_EVENT_DISCRIMINATOR;
    create_event->sync = sync_addr;
    create_event->pump_mint = *accounts->pump_mint.key;

    writer w = writer_new((u8*)create_event, create_event_len);
    writer_skip(&w, offsetof(SyncCreateEvent, strdata));
    writer_write_anchor_string(&w, name);
    writer_write_anchor_string(&w, symbol);
    writer_write_anchor_string(&w, metadata_url);
    writer_write_anchor_string(&w, game_url);

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)create_event, create_event_len),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

/* ------------------------------ */

// #idl instruction accounts sync_swap
typedef struct {
    // Sync state
    // #idl readonly
    SolAccountInfo sync;

    // Pump.fun required accounts
    // #idl readonly
    SolAccountInfo global;
    // #idl writable
    SolAccountInfo fee_recipient;
    // #idl readonly
    SolAccountInfo mint; // Pump.fun mint (must equal Sync.pump_mint)
    // #idl writable
    SolAccountInfo bonding_curve;
    // #idl writable
    SolAccountInfo associated_bonding_curve;
    // #idl writable
    SolAccountInfo associated_user;
    // #idl writable
    SolAccountInfo creator_vault;
    // #idl readonly
    SolAccountInfo pump_event_authority;
    // #idl readonly
    SolAccountInfo pump_program;
    // #idl writable
    SolAccountInfo global_volume_accumulator;
    // #idl writable
    SolAccountInfo user_volume_accumulator;

    // User
    // #idl writable signer
    SolAccountInfo user;

    // Sync bridging accounts
    // #idl readonly
    SolAccountInfo sync_mint; // must equal Sync.sync_mint
    // #idl writable
    SolAccountInfo sync_treasury_wallet; // must equal Sync.sync_wallet
    // #idl writable
    SolAccountInfo pump_treasury_wallet; // must equal Sync.pump_wallet
    // #idl writable
    SolAccountInfo user_sync_ata;

    // Programs
    // #idl readonly
    SolAccountInfo system_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo ata_program;

    // #idl readonly
    SolAccountInfo world;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
} SyncSwapAccounts;

// #idl instruction data sync_swap
typedef struct packed {
    u64 amount; // SOL amount for buy, sync-token amount for sell
    u64 min_output; // min token (sync) output for buy, min SOL output for sell
    bool is_buy; // true for buy, false for sell
} SyncSwapData;

// #idl instruction discriminator sync_swap
static const u64 SYNC_SWAP_DISCRIMINATOR = UINT64_C(0xd6189640120527d5);

// #idl instruction declaration
static void sync_swap(
    const Context* ctx, SyncSwapAccounts* accounts, const SyncSwapData* data
) {
    require(accounts->user.is_signer, "User must be a signer");

    // Verify Pump.fun program IDs
    require(
        address_equal(accounts->global.key, &PUMP_GLOBAL), "Invalid global account"
    );
    require(
        address_equal(accounts->pump_event_authority.key, &PUMP_EVENT_AUTHORITY),
        "Invalid event authority"
    );
    require(
        address_equal(accounts->pump_program.key, &PUMP_PROGRAM_ID),
        "Invalid pump program"
    );

    // Load sync state and verify wiring
    const Sync* s = sync_load(ctx, &accounts->sync);
    require(
        address_equal(accounts->mint.key, &s->pump_mint), "Mismatched Pump.fun mint"
    );
    require(
        address_equal(accounts->sync_mint.key, &s->sync_mint), "Mismatched sync mint"
    );
    require(
        address_equal(accounts->sync_treasury_wallet.key, &s->sync_wallet),
        "Mismatched sync wallet"
    );
    require(
        address_equal(accounts->pump_treasury_wallet.key, &s->pump_wallet),
        "Mismatched pump wallet"
    );

    // PDA seeds for signed transfers
    slice sync_wallet_seeds[2] = {
        slice_from_str(SYNC_SYNC_WALLET_PREFIX), slice_from_address(accounts->sync.key)
    };
    slice pump_wallet_seeds[2] = {
        slice_from_str(SYNC_PUMP_WALLET_PREFIX), slice_from_address(accounts->sync.key)
    };

    // Ensure the user's Pump.fun ATA exists
    if (!token_exists(&accounts->associated_user)) {
        ata_create(
            ctx,
            /* payer */ *accounts->user.key,
            /* ata */ *accounts->associated_user.key,
            /* owner */ *accounts->user.key,
            /* mint */ *accounts->mint.key
        );
        sol_refresh_data_len(&accounts->associated_user);
    }

    u64 output_amount = 0;
    if (data->is_buy) {
        // Collect fee in SOL before swap
        u64 fee_amount = safe_mul_div_64(data->amount, SYNC_FEE_BPS, 10000);
        u64 amount_after_fee = safe_sub_64(data->amount, fee_amount);

        // Transfer fee to beneficiary
        system_transfer(ctx, *accounts->user.key, SYNC_BENEFICIARY, fee_amount);

        // Pump.fun `buy`s are denominated in ExactOut.
        // Since we want to use ExactIn, we have to back-calculate.
        // Pump.fun calculates like this:
        // - sol_input = cp_curve_exact_out(virtual_sol_reserves, virtual_token_reserves, token_output)
        // - amount = sol_input + ceil(sol_input * 0.0095) + ceil(sol_input * 0.0005)
        // So, to get from `amount` to `token_output`, first we must realize:
        // - amount >= sol_input * 1.01     (due to the ceil)
        // - sol_input <= amount / 1.01
        // This is very close, so we can then iterate downwards until we find the `sol_input` that satisfies:
        // - sol_input + ceil(sol_input * 0.0095) + ceil(sol_input * 0.0005) <= amount
        // (We don't want to consume more than `amount` of the input.)
        // Now, all we have left is to get the token amount.
        // - token_output_estimate = cp_curve_exact_in(virtual_sol_reserves, virtual_token_reserves, sol_input)
        // - token_output_estimate <= token_output
        // (Why is this true? Well, if ExactIn(ExactOut(token_output)) > token_output,
        // CPMMs would have a serious economic problem!)
        // We could refine this estimate further, but we won't bother, because it's not a big deal
        // if we have a few lamports more than we expected. Unlike token amounts,
        // the user can keep them for free!
        const PumpBondingCurve* curve =
            pump_bonding_curve_load(&accounts->bonding_curve);
        const PumpGlobal* global = pump_global_load(&accounts->global);
        u64 total_fee_bps = global->fee_basis_points + global->creator_fee_basis_points;

        // The "real" `sol_input` is guaranteed to be below this amount
        u64 sol_input = safe_mul_div_64(amount_after_fee, 10000, 10000 + total_fee_bps);
        while (true) {
            // This will not go on for more than a few iterations
            u64 protocol_fee =
                safe_mul_div_ceil_64(sol_input, global->fee_basis_points, 10000);
            u64 creator_fee = safe_mul_div_ceil_64(
                sol_input, global->creator_fee_basis_points, 10000
            );
            u64 amount = sol_input + protocol_fee + creator_fee;
            if (amount > amount_after_fee) {
                sol_input = safe_sub_64(sol_input, 1);
            } else {
                break;
            }
        }

        // Convert ExactOut -> ExactIn
        u64 token_output = cp_curve_exact_in(
            curve->virtual_sol_reserves, curve->virtual_token_reserves, sol_input
        );
        require(token_output >= data->min_output, "Slippage tolerance exceeded");

        // Get amount before
        u64 pump_before = token_get_balance(&accounts->associated_user);

        // Execute Pump.fun buy
        pump_buy(
            ctx,
            /* fee_recipient */ *accounts->fee_recipient.key,
            /* mint */ *accounts->mint.key,
            /* user */ *accounts->user.key,
            /* bonding_curve */ *accounts->bonding_curve.key,
            /* associated_bonding_curve */ *accounts->associated_bonding_curve.key,
            /* associated_user */ *accounts->associated_user.key,
            /* creator_vault */ *accounts->creator_vault.key,
            /* global_volume_accumulator */ *accounts->global_volume_accumulator.key,
            /* user_volume_accumulator */ *accounts->user_volume_accumulator.key,
            /* amount */ token_output,
            /* max_sol_cost */ amount_after_fee
        );

        // Move received Pump.fun tokens to program custody
        u64 pump_after = token_get_balance(&accounts->associated_user);
        output_amount = safe_sub_64(pump_after, pump_before);
        require(
            output_amount >= data->min_output, "Received less tokens than expected"
        );
        token_transfer(
            ctx,
            /* source */ *accounts->associated_user.key,
            /* destination */ s->pump_wallet,
            /* owner */ *accounts->user.key,
            /* amount */ output_amount
        );

        // Ensure user's sync ATA exists
        if (!token_exists(&accounts->user_sync_ata)) {
            ata_create(
                ctx,
                /* payer */ *accounts->user.key,
                /* ata */ *accounts->user_sync_ata.key,
                /* owner */ *accounts->user.key,
                /* mint */ s->sync_mint
            );
        }

        // Deliver mirrored sync tokens
        token_transfer_signed(
            ctx,
            /* source */ s->sync_wallet,
            /* destination */ *accounts->user_sync_ata.key,
            /* owner */ s->sync_wallet,
            /* amount */ output_amount,
            /* owner_seeds */ sync_wallet_seeds,
            /* owner_seeds_len */ SOL_ARRAY_SIZE(sync_wallet_seeds)
        );
    } else {
        // SELL: user provides sync-tokens; we mirror by providing Pump.fun tokens,
        // perform pump_sell, and user receives SOL
        // 1) Take sync tokens from user into our sync treasury
        token_transfer(
            ctx,
            /* source */ *accounts->user_sync_ata.key,
            /* destination */ s->sync_wallet,
            /* owner */ *accounts->user.key,
            /* amount */ data->amount
        );

        // Close the user's sync token account if there's nothing left
        if (!token_get_balance(&accounts->user_sync_ata)) {
            token_close_account(
                ctx,
                /* account */ *accounts->user_sync_ata.key,
                /* destination */ *accounts->user.key,
                /* owner */ *accounts->user.key
            );
        }

        // Get amount before
        u64 pump_before = token_get_balance(&accounts->associated_user);

        // 2) Move Pump.fun tokens from program custody to user so pump program can debit them
        token_transfer_signed(
            ctx,
            /* source */ s->pump_wallet,
            /* destination */ *accounts->associated_user.key,
            /* owner */ s->pump_wallet,
            /* amount */ data->amount,
            /* owner_seeds */ pump_wallet_seeds,
            /* owner_seeds_len */ SOL_ARRAY_SIZE(pump_wallet_seeds)
        );

        u64 sol_before = *accounts->user.lamports;

        // 3) Execute Pump.fun sell (ExactIn tokens -> SOL)
        pump_sell(
            ctx,
            /* fee_recipient */ *accounts->fee_recipient.key,
            /* mint */ *accounts->mint.key,
            /* user */ *accounts->user.key,
            /* bonding_curve */ *accounts->bonding_curve.key,
            /* associated_bonding_curve */ *accounts->associated_bonding_curve.key,
            /* associated_user */ *accounts->associated_user.key,
            /* creator_vault */ *accounts->creator_vault.key,
            /* amount */ data->amount,
            /* min_sol_output */ data->min_output
        );

        u64 sol_after = *accounts->user.lamports;
        output_amount = safe_sub_64(sol_after, sol_before);

        // Collect fee from SOL output
        u64 fee_amount = safe_mul_div_64(output_amount, SYNC_FEE_BPS, 10000);
        system_transfer(ctx, *accounts->user.key, SYNC_BENEFICIARY, fee_amount);
        output_amount = safe_sub_64(output_amount, fee_amount);

        // Get amount after
        u64 pump_after = token_get_balance(&accounts->associated_user);

        // If there is a difference, it's dust, transfer it to program
        u64 dust = safe_sub_64(pump_after, pump_before);
        if (dust) {
            token_transfer(
                ctx,
                /* source */ *accounts->associated_user.key,
                /* destination */ s->pump_wallet,
                /* owner */ *accounts->user.key,
                /* amount */ dust
            );
        }
    }

    // Close the user's pump token account if it's empty
    if (!token_get_balance(&accounts->associated_user)) {
        token_close_account(
            ctx,
            /* account */ *accounts->associated_user.key,
            /* destination */ *accounts->user.key,
            /* owner */ *accounts->user.key
        );
    }

    // Load world to get event authority
    const World* world = world_load(ctx, &accounts->world);

    // Emit swap event
    SyncSwapEvent swap_event = {
        .discriminator = SYNC_SWAP_EVENT_DISCRIMINATOR,
        .sync = *accounts->sync.key,
        .user = *accounts->user.key,
        .sol_amount = data->is_buy ? data->amount : output_amount,
        .token_amount = data->is_buy ? output_amount : data->amount,
        .is_buy = data->is_buy,
        .is_pswap = false
    };

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)&swap_event, sizeof(swap_event)),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

/* ------------------------------ */

// #idl instruction accounts sync_pswap
typedef struct {
    // Sync state
    // #idl readonly
    SolAccountInfo sync;

    // #idl writable signer
    SolAccountInfo user;

    // PumpSwap pool + config
    // #idl readonly
    SolAccountInfo pswap_pool;
    // #idl readonly
    SolAccountInfo pswap_global_config;

    // Mints
    // #idl writable
    SolAccountInfo token_mint; // Pump token mint (must equal Sync.pump_mint)
    // #idl readonly
    SolAccountInfo wsol_mint;

    // User token accounts
    // #idl writable
    SolAccountInfo user_pump_account; // Pump token ATA (user)
    // #idl writable
    SolAccountInfo user_wsol_account; // WSOL ATA (user)

    // Pool token accounts
    // #idl writable
    SolAccountInfo pool_token_account;
    // #idl writable
    SolAccountInfo pool_wsol_account;

    // Fees and programs
    // #idl readonly
    SolAccountInfo protocol_fee_recipient;
    // #idl writable
    SolAccountInfo protocol_fee_recipient_token_account;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo system_program;
    // #idl readonly
    SolAccountInfo ata_program;
    // #idl readonly
    SolAccountInfo pswap_event_authority;
    // #idl readonly
    SolAccountInfo pswap_program;

    // Creator fee accounts
    // #idl writable
    SolAccountInfo coin_creator_vault_ata;
    // #idl readonly
    SolAccountInfo coin_creator_vault_authority;

    // Volume accumulators (used for pswap_buy path)
    // #idl writable
    SolAccountInfo global_volume_accumulator;
    // #idl writable
    SolAccountInfo user_volume_accumulator;

    // Sync bridging accounts
    // #idl readonly
    SolAccountInfo sync_mint; // must equal Sync.sync_mint
    // #idl writable
    SolAccountInfo sync_treasury_wallet; // must equal Sync.sync_wallet
    // #idl writable
    SolAccountInfo pump_treasury_wallet; // must equal Sync.pump_wallet
    // #idl writable
    SolAccountInfo user_sync_account;

    // #idl readonly
    SolAccountInfo world;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo beneficiary;
} SyncPswapAccounts;

// #idl instruction data sync_pswap
typedef struct packed {
    u64 amount; // Token amount for sell, SOL amount for buy
    u64 min_output; // Minimum output expected (tokens for buy, SOL for sell)
    bool is_buy; // true for buy, false for sell
} SyncPswapData;

// #idl instruction discriminator sync_pswap
static const u64 SYNC_PSWAP_DISCRIMINATOR = UINT64_C(0x1ac30f92cda5d96c);

// #idl instruction declaration
static void sync_pswap(
    const Context* ctx, SyncPswapAccounts* accounts, const SyncPswapData* data
) {
    require(accounts->user.is_signer, "User must be a signer");
    require(
        address_equal(accounts->pswap_program.key, &PSWAP_PROGRAM_ID),
        "Invalid PumpSwap program"
    );

    // Load sync state and verify wiring
    const Sync* s = sync_load(ctx, &accounts->sync);
    require(
        address_equal(accounts->token_mint.key, &s->pump_mint), "Mismatched PF mint"
    );
    require(
        address_equal(accounts->sync_mint.key, &s->sync_mint), "Mismatched sync mint"
    );
    require(
        address_equal(accounts->sync_treasury_wallet.key, &s->sync_wallet),
        "Mismatched sync wallet"
    );
    require(
        address_equal(accounts->pump_treasury_wallet.key, &s->pump_wallet),
        "Mismatched pump wallet"
    );

    // PDA seeds for signed transfers
    slice sync_wallet_seeds[2] = {
        slice_from_str(SYNC_SYNC_WALLET_PREFIX), slice_from_address(accounts->sync.key)
    };
    slice pump_wallet_seeds[2] = {
        slice_from_str(SYNC_PUMP_WALLET_PREFIX), slice_from_address(accounts->sync.key)
    };

    // Load pool + config
    const PswapPool* pool = pswap_pool_load(&accounts->pswap_pool);
    const PswapGlobalConfig* gc =
        pswap_global_config_load(&accounts->pswap_global_config);

    // Mint validation
    require(
        address_equal(&pool->base_mint, &s->pump_mint) ||
            address_equal(&pool->quote_mint, &s->pump_mint),
        "not a valid PF AMM pool for this mint"
    );

    // Mint orientation
    bool wsol_is_base = address_equal(&pool->base_mint, accounts->wsol_mint.key);
    bool wsol_is_quote = address_equal(&pool->quote_mint, accounts->wsol_mint.key);
    require(wsol_is_base || wsol_is_quote, "Pool must have WSOL as base or quote");
    require(
        !(wsol_is_base && wsol_is_quote), "Pool cannot have WSOL as both base and quote"
    );

    // Ensure WSOL + pump ATAs
    if (!token_exists(&accounts->user_wsol_account)) {
        ata_create(
            ctx,
            *accounts->user.key,
            *accounts->user_wsol_account.key,
            *accounts->user.key,
            *accounts->wsol_mint.key
        );
        sol_refresh_data_len(&accounts->user_wsol_account);
    }
    if (!token_exists(&accounts->user_pump_account)) {
        ata_create(
            ctx,
            *accounts->user.key,
            *accounts->user_pump_account.key,
            *accounts->user.key,
            *accounts->token_mint.key
        );
        sol_refresh_data_len(&accounts->user_pump_account);
    }

    // Set handy pointers for pool/user sides
    address* base_mint;
    address* quote_mint;
    address* user_base_account;
    address* user_quote_account;
    address* pool_base_account;
    address* pool_quote_account;

    if (wsol_is_base) {
        base_mint = accounts->wsol_mint.key;
        quote_mint = accounts->token_mint.key;
        user_base_account = accounts->user_wsol_account.key;
        user_quote_account = accounts->user_pump_account.key;
        pool_base_account = accounts->pool_wsol_account.key;
        pool_quote_account = accounts->pool_token_account.key;
    } else {
        base_mint = accounts->token_mint.key;
        quote_mint = accounts->wsol_mint.key;
        user_base_account = accounts->user_pump_account.key;
        user_quote_account = accounts->user_wsol_account.key;
        pool_base_account = accounts->pool_token_account.key;
        pool_quote_account = accounts->pool_wsol_account.key;
    }

    // Helpers to read pool balances
    const SolAccountInfo* pool_quote_token_account =
        (pool_quote_account == accounts->pool_wsol_account.key)
        ? &accounts->pool_wsol_account
        : &accounts->pool_token_account;
    const SolAccountInfo* pool_base_token_account =
        (pool_base_account == accounts->pool_wsol_account.key)
        ? &accounts->pool_wsol_account
        : &accounts->pool_token_account;

    // STEP 1: Prepare source account for PF AMM based on BUY/SELL
    u64 token_before = token_get_balance(&accounts->user_pump_account);
    u64 swap_amount = data->amount;

    if (data->is_buy) {
        // Collect fee in SOL before swap
        u64 fee_amount = safe_mul_div_64(data->amount, SYNC_FEE_BPS, 10000);
        swap_amount = safe_sub_64(data->amount, fee_amount);

        // Transfer fee to beneficiary
        system_transfer(ctx, *accounts->user.key, SYNC_BENEFICIARY, fee_amount);

        // BUY: Prepare WSOL for swap
        system_transfer(
            ctx, *accounts->user.key, *accounts->user_wsol_account.key, swap_amount
        );
        token_sync_native(ctx, *accounts->user_wsol_account.key);
    } else {
        // SELL: Transfer sync tokens to treasury and prepare pump tokens
        token_transfer(
            ctx,
            /* source */ *accounts->user_sync_account.key,
            /* destination */ s->sync_wallet,
            /* owner */ *accounts->user.key,
            /* amount */ data->amount
        );

        token_transfer_signed(
            ctx,
            /* source */ s->pump_wallet,
            /* destination */ *accounts->user_pump_account.key,
            /* owner */ s->pump_wallet,
            /* amount */ data->amount,
            /* owner_seeds */ pump_wallet_seeds,
            /* owner_seeds_len */ SOL_ARRAY_SIZE(pump_wallet_seeds)
        );
    }

    // STEP 2: Execute swap
    bool use_sell = (data->is_buy == wsol_is_base);

    u64 output_amount = 0;
    if (use_sell) {
        u64 pre_amount = token_get_balance(
            data->is_buy ? &accounts->user_pump_account : &accounts->user_wsol_account
        );
        // ExactIn swap via pswap_sell (BASE -> QUOTE)
        pswap_sell(
            ctx,
            /* pool */ *accounts->pswap_pool.key,
            /* user */ *accounts->user.key,
            /* global_config */ *accounts->pswap_global_config.key,
            /* base_mint */ *base_mint,
            /* quote_mint */ *quote_mint,
            /* user_base_token_account */ *user_base_account,
            /* user_quote_token_account */ *user_quote_account,
            /* pool_base_token_account */ *pool_base_account,
            /* pool_quote_token_account */ *pool_quote_account,
            /* protocol_fee_recipient */ *accounts->protocol_fee_recipient.key,
            /* protocol_fee_recipient_token_account */
            *accounts->protocol_fee_recipient_token_account.key,
            /* base_token_program */ *accounts->token_program.key,
            /* quote_token_program */ *accounts->token_program.key,
            /* event_authority */ *accounts->pswap_event_authority.key,
            /* coin_creator_vault_ata */ *accounts->coin_creator_vault_ata.key,
            /* coin_creator_vault_authority */
            *accounts->coin_creator_vault_authority.key,
            /* base_amount_in */ swap_amount,
            /* min_quote_amount_out */ data->min_output
        );
        u64 post_amount = token_get_balance(
            data->is_buy ? &accounts->user_pump_account : &accounts->user_wsol_account
        );
        output_amount = safe_sub_64(post_amount, pre_amount);
    } else {
        // Calculate creator fee
        u64 coin_creator_fee_basis_points =
            address_equal(&pool->coin_creator, &ADDRESS_ZERO)
            ? 0
            : gc->coin_creator_fee_basis_points;

        // ExactOut swap via pswap_buy - convert ExactIn to ExactOut
        u64 total_fee_bps = gc->lp_fee_basis_points + gc->protocol_fee_basis_points +
            coin_creator_fee_basis_points;

        u64 actual_input = safe_mul_div_64(swap_amount, 10000, 10000 + total_fee_bps);
        while (true) {
            u64 lp_fee =
                safe_mul_div_ceil_64(actual_input, gc->lp_fee_basis_points, 10000);
            u64 protocol_fee = safe_mul_div_ceil_64(
                actual_input, gc->protocol_fee_basis_points, 10000
            );
            u64 creator_fee = safe_mul_div_ceil_64(
                actual_input, coin_creator_fee_basis_points, 10000
            );
            u64 amount = actual_input + lp_fee + protocol_fee + creator_fee;
            if (amount > swap_amount) {
                actual_input = safe_sub_64(actual_input, 1);
            } else {
                break;
            }
        }

        const u64 pool_quote_balance = token_get_balance(pool_quote_token_account);
        const u64 pool_base_balance = token_get_balance(pool_base_token_account);
        u64 base_output =
            cp_curve_exact_in(pool_quote_balance, pool_base_balance, actual_input);
        require(base_output >= data->min_output, "Slippage tolerance exceeded");
        output_amount = base_output;

        // Execute Buy (QUOTE -> BASE)
        pswap_buy(
            ctx,
            /* pool */ *accounts->pswap_pool.key,
            /* user */ *accounts->user.key,
            /* global_config */ *accounts->pswap_global_config.key,
            /* base_mint */ *base_mint,
            /* quote_mint */ *quote_mint,
            /* user_base_token_account */ *user_base_account,
            /* user_quote_token_account */ *user_quote_account,
            /* pool_base_token_account */ *pool_base_account,
            /* pool_quote_token_account */ *pool_quote_account,
            /* protocol_fee_recipient */ *accounts->protocol_fee_recipient.key,
            /* protocol_fee_recipient_token_account */
            *accounts->protocol_fee_recipient_token_account.key,
            /* base_token_program */ *accounts->token_program.key,
            /* quote_token_program */ *accounts->token_program.key,
            /* event_authority */ *accounts->pswap_event_authority.key,
            /* coin_creator_vault_ata */ *accounts->coin_creator_vault_ata.key,
            /* coin_creator_vault_authority */
            *accounts->coin_creator_vault_authority.key,
            /* global_volume_accumulator */
            *accounts->global_volume_accumulator.key,
            /* user_volume_accumulator */ *accounts->user_volume_accumulator.key,
            /* base_amount_out */ base_output,
            /* max_quote_amount_in */ swap_amount
        );
    }

    // STEP 3: Post-swap cleanup based on BUY/SELL
    u64 token_after = token_get_balance(&accounts->user_pump_account);
    // note: when we're buying, this is the amount of PF tokens that we
    //       received, when we're selling, this is the amount of PF tokens
    //       that are "left over" if we're unable to sell them all due to
    //       ExactOut semantics! (btw - this will be at max like 1 or 2
    //       raw, the user will not lose anything from us reclaiming these.)
    u64 received = safe_sub_64(token_after, token_before);

    // Move received/leftover PF tokens to custody
    if (received > 0) {
        token_transfer(
            ctx,
            /* source */ *accounts->user_pump_account.key,
            /* destination */ s->pump_wallet,
            /* owner */ *accounts->user.key,
            /* amount */ received
        );
    }

    if (data->is_buy) {
        require(received >= data->min_output, "Received less tokens than expected");

        // Create sync account if not exists
        if (!token_exists(&accounts->user_sync_account)) {
            ata_create(
                ctx,
                /* payer */ *accounts->user.key,
                /* associated_token_address */ *accounts->user_sync_account.key,
                /* owner_address */ *accounts->user.key,
                /* mint */ s->sync_mint
            );
        }

        // Transfer sync tokens to user
        token_transfer_signed(
            ctx,
            /* source */ s->sync_wallet,
            /* destination */ *accounts->user_sync_account.key,
            /* owner */ s->sync_wallet,
            /* amount */ received,
            /* owner_seeds */ sync_wallet_seeds,
            /* owner_seeds_len */ SOL_ARRAY_SIZE(sync_wallet_seeds)
        );
    } else {
        // Close sync account if empty
        if (!token_get_balance(&accounts->user_sync_account)) {
            token_close_account(
                ctx,
                /* account */ *accounts->user_sync_account.key,
                /* destination */ *accounts->user.key,
                /* owner */ *accounts->user.key
            );
        }
    }

    // Close WSOL account to redeem SOL
    token_close_account(
        ctx, *accounts->user_wsol_account.key, *accounts->user.key, *accounts->user.key
    );

    if (!data->is_buy) {
        // Collect fee in SOL after swap
        u64 fee_amount = safe_mul_div_64(output_amount, SYNC_FEE_BPS, 10000);
        output_amount = safe_sub_64(output_amount, fee_amount);

        // Transfer fee to beneficiary
        system_transfer(ctx, *accounts->user.key, SYNC_BENEFICIARY, fee_amount);
    }

    // Close pump account if empty
    if (!token_get_balance(&accounts->user_pump_account)) {
        token_close_account(
            ctx,
            /* account */ *accounts->user_pump_account.key,
            /* destination */ *accounts->user.key,
            /* owner */ *accounts->user.key
        );
    }

    // Load world to get event authority
    const World* world = world_load(ctx, &accounts->world);

    // Emit swap event
    SyncSwapEvent swap_event = {
        .discriminator = SYNC_SWAP_EVENT_DISCRIMINATOR,
        .sync = *accounts->sync.key,
        .user = *accounts->user.key,
        .sol_amount = data->is_buy ? data->amount : output_amount,
        .token_amount = data->is_buy ? output_amount : data->amount,
        .is_buy = data->is_buy,
        .is_pswap = true
    };

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)&swap_event, sizeof(swap_event)),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

#endif
