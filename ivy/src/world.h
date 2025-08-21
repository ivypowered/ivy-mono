#ifndef IVY_WORLD_H
#define IVY_WORLD_H

#include "safe_math.h"
#include "sqrt_curve.h"
#include "util.h"
#include "ivy-lib/event.h"
#include <ivy-lib/alt.h>
#include <ivy-lib/ata.h>
#include <ivy-lib/context.h>
#include <ivy-lib/metadata.h>
#include <ivy-lib/system.h>
#include <ivy-lib/token.h>
#include <ivy-lib/types.h>
#include <solana_sdk.h>

static const char* const WORLD_PREFIX = "world";
static const char* const WORLD_USDC_PREFIX = "world_usdc";
static const char* const WORLD_CURVE_PREFIX = "world_curve";
static const char* const WORLD_VESTING_PREFIX = "world_vesting";
static const char* const WORLD_MINT_PREFIX = "world_mint";

static const u8 IVY_DECIMALS = 9;
static const u8 USDC_DECIMALS = 6;

// EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
static const address USDC_MINT = {
    .x = {198, 250, 122, 243, 190, 219, 173, 58,  61,  101, 243, 106, 171, 201, 116, 49,
          177, 187, 228, 194, 210, 246, 224, 228, 124, 166, 2,   3,   69,  47,  93,  97}
};

// #idl event declaration
typedef struct {
    u64 discriminator;
    u64 ivy_curve_max;
    u32 curve_input_scale_num;
    u32 curve_input_scale_den;
} WorldCreateEvent;

// #idl event discriminator WorldCreateEvent
static const u64 WORLD_CREATE_EVENT_DISCRIMINATOR = UINT64_C(0x236d8df4463cb849);

// #idl event declaration
typedef struct {
    u64 discriminator;
    u64 ivy_initial_liquidity;
    u64 game_initial_liquidity;
    u8 ivy_fee_bps;
    u8 game_fee_bps;
} WorldUpdateEvent;

// #idl event discriminator WorldUpdateEvent
static const u64 WORLD_UPDATE_EVENT_DISCRIMINATOR = UINT64_C(0x49166e011f4d3444);

// #idl event declaration
typedef struct {
    u64 discriminator;
    address user;
    u64 usdc_balance;
    u64 ivy_sold;
    u64 usdc_amount;
    u64 ivy_amount;
    bool is_buy;
} WorldSwapEvent;

// #idl event discriminator WorldSwapEvent
static const u64 WORLD_SWAP_EVENT_DISCRIMINATOR = UINT64_C(0x774452a7872e259e);

// #idl event declaration
typedef struct {
    u64 discriminator;
    u64 ivy_amount;
    u64 ivy_vested;
} WorldVestingEvent;

// #idl event discriminator WorldVestingEvent
static const u64 WORLD_VESTING_EVENT_DISCRIMINATOR = UINT64_C(0x23d7eb52cbccae12);

// #idl struct declaration
typedef struct {
    u64 discriminator;

    /// The Ivy mint address
    address ivy_mint;
    /// The world's USDC curve wallet
    address usdc_wallet;
    /// The world's IVY curve wallet
    address curve_wallet;
    /// The world's IVY vesting wallet
    address vesting_wallet;
    /// The world's event authority
    address event_authority;
    /// The world's ALT
    /// We need this to make `game_create()`
    /// fit within 1232 bytes
    /// It also helps with composite IVY swap transactions
    address world_alt;

    /// The owner of Ivy
    address owner;
    /// The USDC balance deposited to the curve
    u64 usdc_balance;
    /// The amount of IVY tokens purchased from the curve
    u64 ivy_curve_sold;
    /// The max amount of IVY tokens that can be purchased
    /// from the curve
    u64 ivy_curve_max;
    /// The amount of IVY tokens released from vesting
    /// We use a simplified form of vesting:
    /// - If X% of curve tokens have been purchased,
    ///  then X% of vesting tokens can be released.
    /// Thus,
    /// - ivy_vesting_released = ivy_vesting_max * (ivy_curve_sold / ivy_curve_max)
    /// Note: For simplicity, we only perform this check
    ///     when claimVesting() is called, so if the curve
    ///     is bid up to Y% but then falls down to Z% when
    ///     the function is called, only Z% will be claimable.
    u64 ivy_vesting_released;
    /// The max amount of IVY tokens released from vesting
    u64 ivy_vesting_max;
    /// The initial IVY liquidity in games'
    /// virtual token bonding curve
    u64 ivy_initial_liquidity;
    /// The initial game token liquidity in games'
    /// virtual token bonding curve
    u64 game_initial_liquidity;
    /// The numerator of the value multiplied by the input
    /// IVY curve. It's the variable `a` in the
    /// formula `price = sqrt((a / b) * supply)`.
    u32 curve_input_scale_num;
    /// The denominator of the value multiplied by the input
    /// IVY curve. It's the variable `b` in the
    /// formula `price = sqrt((a / b) * supply)`.
    u32 curve_input_scale_den;
    /// The amount that Ivy charges for game swaps;
    /// it is burned, returning value to token holders
    /// (Note: these are for game swaps, swaps
    /// to and from IVY are free)
    u8 ivy_fee_bps;
    /// The amount that games charge for game swaps;
    /// collected in the game token to the game's
    /// treasury wallet
    u8 game_fee_bps;

    /// The world's nonce
    u8 world_nonce;
    /// The Ivy mint nonce
    u8 ivy_mint_nonce;
    /// The world's USDC curve wallet nonce
    u8 usdc_wallet_nonce;
    /// The world's IVY curve wallet nonce
    u8 curve_wallet_nonce;
    /// The world's IVY vesting wallet nonce
    u8 vesting_wallet_nonce;
    /// The world's event authority nonce
    u8 event_authority_nonce;
} World;

// #idl struct discriminator World
static const u64 WORLD_DISCRIMINATOR = UINT64_C(0xc7e79b4bbe20d727);

/// `world_load` takes any arbitrary `SolAccountInfo` and attempts to
/// deserialize it as a valid `World` from it, reverting if this operation
/// would be invalid.
static World* world_load(const Context* ctx, const SolAccountInfo* world) {
    // See SECURITY.md for more details
    // 1. Ensure account ownership
    require(
        address_equal(ctx->program_id, world->owner), "Incorrect World account owner"
    );
    // 2. Ensure data is of necessary length
    require(world->data_len >= sizeof(World), "Provided World account data too small");
    World* w = (World*)world->data;
    // 3. Verify discriminator
    require(
        w->discriminator == WORLD_DISCRIMINATOR,
        "Provided World discriminator incorrect"
    );
    return w;
}

/* ------------------------------ */

/* We leave out the receive event from the IDL,
   as it's only called internally. */

typedef struct {
    SolAccountInfo world;
    SolAccountInfo event_authority;
} WorldReceiveEventAccounts;

typedef struct {
    // We don't deserialize any event data
} WorldReceiveEventData;

// use anchor's event IX tag
static const u64 WORLD_RECEIVE_EVENT_DISCRIMINATOR = EVENT_IX_TAG;

// Receive a self-CPI event
static void world_receive_event(
    const Context* ctx,
    const WorldReceiveEventAccounts* accounts,
    const WorldReceiveEventData* data
) {
    // Load world and verify event
    World* world = world_load(ctx, &accounts->world);
    event_verify(&accounts->event_authority, world->event_authority);
}

/* ------------------------------ */

// #idl instruction accounts world_create
typedef struct {
    // #idl writable
    SolAccountInfo world;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo ivy_mint;
    // #idl writable
    SolAccountInfo metadata;
    // #idl writable
    SolAccountInfo usdc_wallet;
    // #idl writable
    SolAccountInfo curve_wallet;
    // #idl writable
    SolAccountInfo vesting_wallet;
    // #idl readonly
    SolAccountInfo metadata_program;
    // #idl readonly
    SolAccountInfo usdc_mint;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo alt_program;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo system_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo rent;
    // #idl writable
    SolAccountInfo world_alt;
} WorldCreateAccounts;

// #idl instruction data world_create
typedef struct {
    bytes64 name;
    bytes16 symbol;
    bytes128 metadata_url;
    u64 ivy_curve_supply;
    u64 ivy_vesting_supply;
    u32 input_scale_num;
    u32 input_scale_den;
    u64 world_alt_slot;
    u8 world_alt_nonce;
} WorldCreateData;

// #idl instruction discriminator world_create
static const u64 WORLD_CREATE_DISCRIMINATOR = UINT64_C(0x95b967c84629339e);

// #idl instruction declaration
static void world_create(
    const Context* ctx, const WorldCreateAccounts* accounts, const WorldCreateData* data
) {
    slice world_seeds_pre[1] = {slice_from_str(WORLD_PREFIX)};
    ProgramDerivedAddress world_pda = find_program_address(
        /* seeds */ world_seeds_pre,
        /* seeds_len */ SOL_ARRAY_SIZE(world_seeds_pre),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't find world address"
    );
    address world_address = world_pda.key;
    u8 world_nonce = world_pda.nonce;

    // Get user
    address user = *accounts->user.key;

    // Create the world account via system program CPI
    slice world_seeds[2] = {slice_from_str(WORLD_PREFIX), slice_new(&world_nonce, 1)};
    system_create_account(
        /* ctx */ ctx,
        /* destination */ world_address,
        /* payer */ user,
        /* owner */ *ctx->program_id,
        /* size */ sizeof(World),
        /* seeds */ world_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(world_seeds)
    );

    // Verify `accounts->world` (untrusted account) before we write to it
    require(
        address_equal(&world_address, accounts->world.key),
        "World address does not match given seeds"
    );
    // Write discriminator and initialize the world
    World* w = (World*)accounts->world.data;
    w->discriminator = WORLD_DISCRIMINATOR;

    // Initialize state variables
    w->owner = user;
    w->usdc_balance = 0;
    w->ivy_curve_sold = 0;
    w->ivy_curve_max = data->ivy_curve_supply;
    w->ivy_vesting_released = 0;
    w->ivy_vesting_max = data->ivy_vesting_supply;
    w->ivy_initial_liquidity = 0;
    w->game_initial_liquidity = 0;
    w->curve_input_scale_num = data->input_scale_num;
    w->curve_input_scale_den = data->input_scale_den;
    w->ivy_fee_bps = 0;
    w->game_fee_bps = 0;

    // Save the world's nonce
    w->world_nonce = world_nonce;

    // Create the IVY mint
    slice mint_seeds_pre[1] = {slice_from_str(WORLD_MINT_PREFIX)};
    ProgramDerivedAddress ivy_mint_pda = find_program_address(
        /* seeds */ mint_seeds_pre,
        /* seeds_len */ SOL_ARRAY_SIZE(mint_seeds_pre),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't find IVY mint address"
    );
    address ivy_mint = ivy_mint_pda.key;
    u8 ivy_mint_nonce = ivy_mint_pda.nonce;
    w->ivy_mint = ivy_mint;
    w->ivy_mint_nonce = ivy_mint_nonce;

    // Create and initialize the IVY token mint via CPI
    slice mint_seeds[2] = {
        slice_from_str(WORLD_MINT_PREFIX), slice_new(&ivy_mint_nonce, 1)
    };
    token_create_mint(
        /* ctx */ ctx,
        /* payer */ user,
        /* mint_address */ ivy_mint,
        /* mint_authority */ user,
        /* freeze_authority */ ADDRESS_ZERO, // No freeze authority
        /* mint_seeds */ mint_seeds,
        /* mint_seeds_len */ SOL_ARRAY_SIZE(mint_seeds),
        /* decimals */ IVY_DECIMALS
    );

    // Create the IVY metadata via CPI
    address metadata_address = metadata_derive_address(ivy_mint);

    MetadataDataV2 metadata_data = {
        .name = slice_from_str_safe(data->name.x, sizeof(data->name.x)),
        .symbol = slice_from_str_safe(data->symbol.x, sizeof(data->symbol.x)),
        .uri = slice_from_str_safe(data->metadata_url.x, sizeof(data->metadata_url.x))
    };

    metadata_create(
        /* ctx */ ctx,
        /* metadata_address */ metadata_address,
        /* mint */ ivy_mint,
        /* mint_authority */ user, // User is initial mint authority
        /* update_authority */ world_address, // World PDA will be update authority
        /* payer */ user,
        /* data */ &metadata_data
    );

    // Create the USDC wallet
    slice usdc_seeds_pre[1] = {slice_from_str(WORLD_USDC_PREFIX)};
    ProgramDerivedAddress usdc_pda = find_program_address(
        /* seeds */ usdc_seeds_pre,
        /* seeds_len */ SOL_ARRAY_SIZE(usdc_seeds_pre),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't find USDC wallet address"
    );
    address usdc_wallet = usdc_pda.key;
    u8 usdc_wallet_nonce = usdc_pda.nonce;
    w->usdc_wallet = usdc_wallet;
    w->usdc_wallet_nonce = usdc_wallet_nonce;

    // Create and initialize USDC token account via CPI
    slice usdc_seeds[2] = {
        slice_from_str(WORLD_USDC_PREFIX), slice_new(&usdc_wallet_nonce, 1)
    };
    token_create_account(
        /* ctx */ ctx,
        /* payer */ user,
        /* token_account */ usdc_wallet,
        /* mint_address */ USDC_MINT,
        /* owner */ usdc_wallet,
        /* token_account_seeds */ usdc_seeds,
        /* token_account_seeds_len */ SOL_ARRAY_SIZE(usdc_seeds)
    );

    // Create the IVY curve wallet
    slice curve_seeds_pre[1] = {slice_from_str(WORLD_CURVE_PREFIX)};
    ProgramDerivedAddress curve_wallet_pda = find_program_address(
        /* seeds */ curve_seeds_pre,
        /* seeds_len */ SOL_ARRAY_SIZE(curve_seeds_pre),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't find curve wallet address"
    );
    address curve_wallet = curve_wallet_pda.key;
    u8 curve_wallet_nonce = curve_wallet_pda.nonce;
    w->curve_wallet = curve_wallet;
    w->curve_wallet_nonce = curve_wallet_nonce;

    // Create and initialize IVY curve token account via CPI
    slice curve_seeds[2] = {
        slice_from_str(WORLD_CURVE_PREFIX), slice_new(&curve_wallet_nonce, 1)
    };
    token_create_account(
        /* ctx */ ctx,
        /* payer */ user,
        /* token_account */ curve_wallet,
        /* mint_address */ ivy_mint,
        /* owner */ curve_wallet,
        /* token_account_seeds */ curve_seeds,
        /* token_account_seeds_len */ SOL_ARRAY_SIZE(curve_seeds)
    );

    // Create the IVY vesting wallet
    slice vesting_seeds_pre[1] = {slice_from_str(WORLD_VESTING_PREFIX)};
    ProgramDerivedAddress vesting_pda = find_program_address(
        /* seeds */ vesting_seeds_pre,
        /* seeds_len */ SOL_ARRAY_SIZE(vesting_seeds_pre),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't find vesting wallet"
    );
    address vesting_wallet = vesting_pda.key;
    w->vesting_wallet = vesting_wallet;
    w->vesting_wallet_nonce = vesting_pda.nonce;

    // Create and initialize IVY vesting token account via CPI
    slice vesting_seeds[2] = {
        slice_from_str(WORLD_VESTING_PREFIX), slice_new(&vesting_pda.nonce, 1)
    };
    token_create_account(
        /* ctx */ ctx,
        /* payer */ user,
        /* token_account */ vesting_wallet,
        /* mint_address */ ivy_mint,
        /* owner */ vesting_wallet,
        /* token_account_seeds */ vesting_seeds,
        /* token_account_seeds_len */ SOL_ARRAY_SIZE(vesting_seeds)
    );

    // Derive and store event authority address and nonce
    ProgramDerivedAddress event_authority_pda =
        event_derive_authority(*ctx->program_id);
    address event_authority = event_authority_pda.key;
    u8 event_authority_nonce = event_authority_pda.nonce;
    w->event_authority = event_authority;
    w->event_authority_nonce = event_authority_nonce;

    // Mint IVY curve supply to curve wallet via CPI
    token_mint(
        /* ctx */ ctx,
        /* mint_address */ ivy_mint,
        /* mint_authority */ user,
        /* destination */ curve_wallet,
        /* amount */ data->ivy_curve_supply
    );

    // Mint IVY vesting supply to vesting wallet via CPI
    token_mint(
        /* ctx */ ctx,
        /* mint_address */ ivy_mint,
        /* mint_authority */ user,
        /* destination */ vesting_wallet,
        /* amount */ data->ivy_vesting_supply
    );

    // Remove IVY mint authority via CPI
    token_set_authority(
        /* ctx */ ctx,
        /* mint_or_token_account */ ivy_mint,
        /* kind */ TOKEN_AUTHORITY_MINT_TOKENS,
        /* authority */ user,
        /* new_authority */ ADDRESS_ZERO // Revoke mint authority
    );

    // Set up game ALT
    // This allows `game_create()` calls to fit in 1232 bytes
    // It also helps with composite IVY swap transactions
    address entries[12] = {
        ivy_mint,
        METAPLEX_PROGRAM_ID,
        world_address,
        event_authority,
        ALT_PROGRAM_ID,
        SYSTEM_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        ATA_PROGRAM_ID,
        usdc_wallet,
        curve_wallet,
        USDC_MINT,
        WSOL_MINT,
    };

    // Set up the ALT
    setup_alt(
        /* ctx */ ctx,
        /* lookup_table */ *accounts->world_alt.key,
        /* authority */ world_address,
        /* payer */ user,
        /* entries */ entries,
        /* entries_len */ SOL_ARRAY_SIZE(entries),
        /* recent_slot */ data->world_alt_slot,
        /* bump_seed */ data->world_alt_nonce,
        /* authority_seeds */ world_seeds,
        /* authority_seeds_len */ SOL_ARRAY_SIZE(world_seeds)
    );

    // Store game ALT address in state
    w->world_alt = *accounts->world_alt.key;

    // Output world create event
    WorldCreateEvent create_event = {
        .discriminator = WORLD_CREATE_EVENT_DISCRIMINATOR,
        .ivy_curve_max = w->ivy_curve_max,
        .curve_input_scale_num = w->curve_input_scale_num,
        .curve_input_scale_den = w->curve_input_scale_den,
    };

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)&create_event, sizeof(create_event)),
        /* global_address */ world_address,
        /* event_authority */ event_authority,
        /* event_authority_nonce */ event_authority_nonce
    );

    // Output initial world update event
    WorldUpdateEvent update_event = {
        .discriminator = WORLD_UPDATE_EVENT_DISCRIMINATOR,
        .ivy_initial_liquidity = w->ivy_initial_liquidity,
        .game_initial_liquidity = w->game_initial_liquidity,
        .ivy_fee_bps = w->ivy_fee_bps,
        .game_fee_bps = w->game_fee_bps
    };

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)&update_event, sizeof(update_event)),
        /* global_address */ world_address,
        /* event_authority */ event_authority,
        /* event_authority_nonce */ event_authority_nonce
    );
}

/* ------------------------------ */

// #idl instruction accounts world_set_owner
typedef struct {
    // #idl writable
    SolAccountInfo world;
    // #idl signer
    SolAccountInfo owner;
} WorldSetOwnerAccounts;

// #idl instruction data world_set_owner
typedef struct {
    address new_owner;
} WorldSetOwnerData;

// #idl instruction discriminator world_set_owner
static const u64 WORLD_SET_OWNER_DISCRIMINATOR = UINT64_C(0xd95d88f00d9f5420);

// Set the owner of the World
// #idl instruction declaration
static void world_set_owner(
    const Context* ctx,
    const WorldSetOwnerAccounts* accounts,
    const WorldSetOwnerData* data
) {
    World* world = world_load(ctx, &accounts->world);
    authorize(&accounts->owner, world->owner);
    world->owner = data->new_owner;
}

/* ------------------------------ */

// #idl instruction accounts world_set_params
typedef struct {
    // #idl writable
    SolAccountInfo world;
    // #idl signer
    SolAccountInfo owner;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
} WorldSetParamsAccounts;

// #idl instruction data world_set_params
typedef struct {
    u64 new_ivy_initial_liquidity;
    u64 new_game_initial_liquidity;
    u8 new_ivy_fee_bps;
    u8 new_game_fee_bps;
} WorldSetParamsData;

// #idl instruction discriminator world_set_params
static const u64 WORLD_SET_PARAMS_DISCRIMINATOR = UINT64_C(0xd0763fc19e807354);

// Set the parameters of the World
// #idl instruction declaration
static void world_set_params(
    const Context* ctx,
    const WorldSetParamsAccounts* accounts,
    const WorldSetParamsData* data
) {
    World* world = world_load(ctx, &accounts->world);

    // Authorize account
    authorize(&accounts->owner, world->owner);

    // Update parameters
    world->ivy_initial_liquidity = data->new_ivy_initial_liquidity;
    world->game_initial_liquidity = data->new_game_initial_liquidity;
    world->ivy_fee_bps = data->new_ivy_fee_bps;
    world->game_fee_bps = data->new_game_fee_bps;

    // Emit update event
    WorldUpdateEvent update_event = {
        .discriminator = WORLD_UPDATE_EVENT_DISCRIMINATOR,
        .ivy_initial_liquidity = world->ivy_initial_liquidity,
        .game_initial_liquidity = world->game_initial_liquidity,
        .ivy_fee_bps = world->ivy_fee_bps,
        .game_fee_bps = world->game_fee_bps
    };

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)&update_event, sizeof(update_event)),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

/* ------------------------------ */

// #idl instruction accounts world_claim_vesting
typedef struct {
    // #idl writable
    SolAccountInfo world;
    // #idl signer
    SolAccountInfo owner;
    // #idl writable
    SolAccountInfo vesting_wallet;
    // #idl writable
    SolAccountInfo destination;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo event_authority;
} WorldClaimVestingAccounts;

// #idl instruction data world_claim_vesting
typedef struct {
    // No data needed for this instruction
} WorldClaimVestingData;

// #idl instruction discriminator world_claim_vesting
static const u64 WORLD_CLAIM_VESTING_DISCRIMINATOR = UINT64_C(0xf73d747d20d38439);

// Claim tokens from vesting based on curve sold percentage
// #idl instruction declaration
static void world_claim_vesting(
    const Context* ctx,
    const WorldClaimVestingAccounts* accounts,
    const WorldClaimVestingData* data
) {
    World* world = world_load(ctx, &accounts->world);
    authorize(&accounts->owner, world->owner);

    // Check account addresses
    require(
        address_equal(&world->vesting_wallet, accounts->vesting_wallet.key),
        "Incorrect vesting wallet provided"
    );

    // ivy_vesting_target = ivy_vesting_max * (ivy_curve_sold / ivy_curve_max)
    u64 ivy_vesting_target = safe_mul_div_64(
        world->ivy_vesting_max, world->ivy_curve_sold, world->ivy_curve_max
    );

    if (world->ivy_vesting_released >= ivy_vesting_target) {
        // Already released all we can
        return;
    }

    u64 release = safe_sub_64(ivy_vesting_target, world->ivy_vesting_released);
    world->ivy_vesting_released = safe_add_64(world->ivy_vesting_released, release);

    // Create seeds for signing the token transfer
    slice vesting_wallet_seeds[2] = {
        slice_from_str(WORLD_VESTING_PREFIX), slice_new(&world->vesting_wallet_nonce, 1)
    };

    // Transfer released tokens via CPI
    token_transfer_signed(
        /* ctx */ ctx,
        /* source */ world->vesting_wallet,
        /* destination */ *accounts->destination.key,
        /* owner */ world->vesting_wallet, // PDA signs
        /* amount */ release,
        /* owner_seeds */ vesting_wallet_seeds,
        /* owner_seeds_len */ SOL_ARRAY_SIZE(vesting_wallet_seeds)
    );

    // Output world vesting event
    WorldVestingEvent vesting_event = {
        .discriminator = WORLD_VESTING_EVENT_DISCRIMINATOR,
        .ivy_amount = release,
        .ivy_vested = world->ivy_vesting_released
    };

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)&vesting_event, sizeof(vesting_event)),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

/* ------------------------------ */

// #idl instruction accounts world_update_metadata
typedef struct {
    // #idl writable
    SolAccountInfo world;
    // #idl signer
    SolAccountInfo owner;
    // #idl writable
    SolAccountInfo metadata;
    // #idl readonly
    SolAccountInfo metadata_program;
} WorldUpdateMetadataAccounts;

// #idl instruction data world_update_metadata
typedef struct {
    bytes64 name;
    bytes16 symbol;
    bytes128 metadata_url;
} WorldUpdateMetadataData;

// #idl instruction discriminator world_update_metadata
static const u64 WORLD_UPDATE_METADATA_DISCRIMINATOR = UINT64_C(0x08fa27d9f4fd1eb9);

// Update token metadata (name, symbol, URL)
// #idl instruction declaration
static void world_update_metadata(
    const Context* ctx,
    const WorldUpdateMetadataAccounts* accounts,
    const WorldUpdateMetadataData* data
) {
    World* world = world_load(ctx, &accounts->world);
    authorize(&accounts->owner, world->owner);

    // Prepare metadata struct for CPI
    MetadataDataV2 metadata_data = {
        .name = slice_from_str_safe(data->name.x, sizeof(data->name.x)),
        .symbol = slice_from_str_safe(data->symbol.x, sizeof(data->symbol.x)),
        .uri = slice_from_str_safe(data->metadata_url.x, sizeof(data->metadata_url.x))
    };

    // Create seeds for signing the metadata update
    slice world_seeds[2] = {
        slice_from_str(WORLD_PREFIX), slice_new(&world->world_nonce, 1)
    };

    // Update metadata via CPI
    metadata_update_signed(
        /* ctx */ ctx,
        /* metadata_account */ *accounts->metadata.key,
        /* update_authority */ *accounts->world.key, // World PDA is the authority
        /* new_update_authority */ *accounts->world.key, // Keep same update authority
        /* data */ &metadata_data,
        /* update_authority_seeds */ world_seeds,
        /* update_authority_seeds_len */ SOL_ARRAY_SIZE(world_seeds)
    );
}

/* ------------------------------ */

// #idl instruction accounts world_swap
typedef struct {
    // #idl writable
    SolAccountInfo world;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo source;
    // #idl writable
    SolAccountInfo destination;
    // #idl writable
    SolAccountInfo usdc_wallet;
    // #idl writable
    SolAccountInfo curve_wallet;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo destination_mint;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo ata_program;
    // #idl readonly
    SolAccountInfo system_program;
} WorldSwapAccounts;

// #idl instruction data world_swap
typedef struct {
    u64 amount;
    u64 threshold;
    bool is_buy;
    bool create_dest;
} WorldSwapData;

// #idl instruction discriminator world_swap
static const u64 WORLD_SWAP_DISCRIMINATOR = UINT64_C(0xbce7cc4a14082dc2);

// Swap between USDC and IVY using a sqrt bonding curve
// #idl instruction declaration
static void world_swap(
    const Context* ctx, const WorldSwapAccounts* accounts, const WorldSwapData* data
) {
    World* world = world_load(ctx, &accounts->world);
    u64 amount = data->amount;

    // Extract addresses for accounts involved in the swap
    address user = *accounts->user.key;
    address source_addr = *accounts->source.key;
    address destination_addr = *accounts->destination.key;

    // Calculate swap amounts based on exact input
    u64 user_pays = amount;
    u64 user_receives;

    r128 supply_r = r128_from_token_amount(world->ivy_curve_sold, IVY_DECIMALS);
    r128 input_scale_r = r128_div(
        r128_from_u64(world->curve_input_scale_num),
        r128_from_u64(world->curve_input_scale_den)
    );

    if (data->is_buy) { // [USDC] -> IVY
        r128 max_supply_r = r128_from_token_amount(world->ivy_curve_max, IVY_DECIMALS);
        r128 user_pays_r = r128_from_token_amount(user_pays, USDC_DECIMALS);
        // Calculate IVY received for exact USDC input
        user_receives = r128_to_token_amount(
            sqrt_curve_exact_reserve_in(
                /* supply */ supply_r,
                /* max_supply */ max_supply_r,
                /* input_scale */ input_scale_r,
                /* reserve_amount */ user_pays_r // USDC paid by user
            ),
            IVY_DECIMALS
        ); // use `floor` because user is receiving this amount
    } else { // [IVY] -> USDC
        r128 user_pays_r = r128_from_token_amount(user_pays, IVY_DECIMALS);
        // Calculate USDC received for exact IVY input
        user_receives = r128_to_token_amount(
            sqrt_curve_exact_tokens_in(
                /* supply */ supply_r,
                /* input_scale */ input_scale_r,
                /* token_amount */ user_pays_r // IVY paid by user
            ),
            USDC_DECIMALS
        );
    }

    // Validate received amount against threshold (slippage check)
    require(user_receives >= data->threshold, "Slippage tolerance exceeded");

    // Define curve wallets and prepare seeds based on swap direction
    address input_wallet;
    address output_wallet;
    slice output_wallet_seeds[2];

    if (data->is_buy) { // USDC -> IVY
        // Update world state
        world->usdc_balance = safe_add_64(world->usdc_balance, user_pays);
        world->ivy_curve_sold = safe_add_64(world->ivy_curve_sold, user_receives);

        // Set wallet addresses and seeds
        input_wallet = world->usdc_wallet;
        output_wallet = world->curve_wallet;
        output_wallet_seeds[0] = slice_from_str(WORLD_CURVE_PREFIX);
        output_wallet_seeds[1] = slice_new(&world->curve_wallet_nonce, 1);
    } else { // IVY -> USDC
        // Update world state
        world->usdc_balance = safe_sub_64(world->usdc_balance, user_receives);
        world->ivy_curve_sold = safe_sub_64(world->ivy_curve_sold, user_pays);

        // Set wallet addresses and seeds
        input_wallet = world->curve_wallet;
        output_wallet = world->usdc_wallet;
        output_wallet_seeds[0] = slice_from_str(WORLD_USDC_PREFIX);
        output_wallet_seeds[1] = slice_new(&world->usdc_wallet_nonce, 1);
    }

    // Transfer tokens from user to input wallet via CPI
    token_transfer(
        /* ctx */ ctx,
        /* source */ source_addr,
        /* destination */ input_wallet,
        /* owner */ user,
        /* amount */ user_pays
    );

    if (token_get_balance(&accounts->source) == 0) {
        // Close account if it's empty now
        token_close_account(
            /* ctx */ ctx,
            /* account */ *accounts->source.key,
            /* destination */ *accounts->user.key,
            /* owner */ *accounts->user.key
        );
    }

    if (data->create_dest && !token_exists(&accounts->destination)) {
        // Create destination wallet
        ata_create(
            /* ctx */ ctx,
            /* payer_address */ user,
            /* associated_token_address */ destination_addr,
            /* owner_address */ user,
            /* mint_address */ data->is_buy ? world->ivy_mint : USDC_MINT
        );
    }

    // Transfer tokens from output wallet to user via signed CPI
    token_transfer_signed(
        /* ctx */ ctx,
        /* source */ output_wallet,
        /* destination */ destination_addr,
        /* owner */ output_wallet,
        /* amount */ user_receives,
        /* owner_seeds */ output_wallet_seeds,
        /* owner_seeds_len */ SOL_ARRAY_SIZE(output_wallet_seeds)
    );

    // Emit swap event
    WorldSwapEvent swap_event = {
        .discriminator = WORLD_SWAP_EVENT_DISCRIMINATOR,
        .user = user,
        .usdc_balance = world->usdc_balance,
        .ivy_sold = world->ivy_curve_sold,
        .usdc_amount = data->is_buy ? user_pays : user_receives,
        .ivy_amount = data->is_buy ? user_receives : user_pays,
        .is_buy = data->is_buy
    };

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)&swap_event, sizeof(swap_event)),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

#endif // IVY_WORLD_H
