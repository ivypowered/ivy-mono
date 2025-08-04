#ifndef IVY_GAME_H
#define IVY_GAME_H

#include "cp_curve.h"
#include "safe_math.h"
#include "util.h"
#include "world.h"
#include <ivy-lib/alt.h>
#include <ivy-lib/ata.h>
#include <ivy-lib/context.h>
#include <ivy-lib/ed25519.h>
#include <ivy-lib/metadata.h>
#include <ivy-lib/rent.h>
#include <ivy-lib/system.h>
#include <ivy-lib/token.h>
#include <ivy-lib/types.h>
#include <ivy-lib/utf8.h>
#include <solana_sdk.h>

// === Constants ===

static const char* const GAME_PREFIX = "game";
static const char* const GAME_BURN_PREFIX = "game_burn";
static const char* const GAME_DEPOSIT_PREFIX = "game_deposit";
static const char* const GAME_WITHDRAW_PREFIX = "game_withdraw";
static const char* const GAME_MINT_PREFIX = "game_mint";
static const char* const GAME_IVY_WALLET_PREFIX = "game_ivy_wallet";
static const char* const GAME_CURVE_WALLET_PREFIX = "game_curve_wallet";
static const char* const GAME_TREASURY_WALLET_PREFIX = "game_treasury_wallet";
static const u64 GAME_DECIMALS = 9;

// === Events ===

// #idl event declaration
typedef struct {
    u64 discriminator;
    address game;
    address mint;
    address swap_alt;
    bytes64 name;
    bytes16 symbol;
    u64 ivy_balance;
    u64 game_balance;
} GameCreateEvent;

// #idl event discriminator GameCreateEvent
static const u64 GAME_CREATE_EVENT_DISCRIMINATOR = UINT64_C(0xb9d412f7d15f4b3c);

// #idl event declaration
typedef struct {
    u64 discriminator;
    address game;
    address owner;
    address withdraw_authority;
    bytes128 game_url;
    bytes128 cover_url;
    bytes128 metadata_url;
} GameEditEvent;

// #idl event discriminator GameEditEvent
static const u64 GAME_EDIT_EVENT_DISCRIMINATOR = UINT64_C(0xf0ded0ff3776f1e1);

// #idl event declaration
typedef struct {
    u64 discriminator;
    address game;
    address user;
    u64 ivy_balance;
    u64 game_balance;
    u64 ivy_amount;
    u64 game_amount;
    bool is_buy;
} GameSwapEvent;

// #idl event discriminator GameSwapEvent
static const u64 GAME_SWAP_EVENT_DISCRIMINATOR = UINT64_C(0x5772818798527af3);

// #idl event declaration
typedef struct {
    u64 discriminator;
    address game;
    bytes32 id;
} GameBurnEvent;

// #idl event discriminator GameBurnEvent
static const u64 GAME_BURN_EVENT_DISCRIMINATOR = UINT64_C(0x2829c52d51c0a753);

// #idl event declaration
typedef struct {
    u64 discriminator;
    address game;
    bytes32 id;
} GameDepositEvent;

// #idl event discriminator GameDepositEvent
static const u64 GAME_DEPOSIT_EVENT_DISCRIMINATOR = UINT64_C(0xd1626ad453f9c13c);

// #idl event declaration
typedef struct {
    u64 discriminator;
    address game;
    bytes32 id;
    address withdraw_authority;
} GameWithdrawEvent;

// #idl event discriminator GameWithdrawEvent
static const u64 GAME_WITHDRAW_EVENT_DISCRIMINATOR = UINT64_C(0xbb1188a853869ff6);

// #idl event declaration
typedef struct {
    u64 discriminator;
    address game;
} GamePromoteEvent;

// #idl event discriminator GamePromoteEvent
static const u64 GAME_PROMOTE_EVENT_DISCRIMINATOR = UINT64_C(0x27bc06abd8a8c1ea);

// #idl struct declaration
typedef struct {
    u64 discriminator;

    /// The owner of the game, can change it at will
    address owner;
    /// Withdraw authority - able to sign withdraws that users can claim
    /// from the treasury wallet
    address withdraw_authority;
    /// The URL to the HTML page which the game is loaded from.
    bytes128 game_url;
    /// The URL to the game's cover art.
    bytes128 cover_url;
    /// Reserved for future use
    u8 reserved[127];
    /// Is game an official launch?
    bool is_official_launch;

    /// The game's seed, its unique identifier
    bytes32 seed;
    /// The game's token mint.
    address mint;
    /// The game's IVY wallet
    address ivy_wallet;
    /// The game token wallet for the bonding curve
    address curve_wallet;
    /// The game token wallet for treasury operations
    /// (receives deposits and disburses withdraws)
    address treasury_wallet;
    /// The Address Lookup Table for `swap()`
    address swap_alt;

    /// IVY bonding curve balance
    u64 ivy_balance;
    /// Game token bonding curve balance
    u64 game_balance;
} Game;

// #idl struct discriminator Game
static const u64 GAME_DISCRIMINATOR = UINT64_C(0x84c13fa33c678215);

/// `game_load` takes any arbitrary `SolAccountInfo` and attempts to
/// deserialize it as a valid `Game` from it, reverting if this operation
/// would be invalid.
static Game* game_load(const Context* ctx, const SolAccountInfo* game) {
    // See SECURITY.md for more details
    // 1. Ensure account ownership
    require(
        address_equal(ctx->program_id, game->owner), "Incorrect Game account owner"
    );
    // 2. Ensure data is of necessary length
    require(game->data_len >= sizeof(Game), "Provided Game account data too small");
    Game* g = (Game*)game->data;
    // 3. Verify discriminator
    require(
        g->discriminator == GAME_DISCRIMINATOR, "Provided Game discriminator incorrect"
    );
    return g;
}

/* ------------------------------ */

// #idl instruction accounts game_create
typedef struct {
    // #idl writable
    SolAccountInfo game;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo mint;
    // #idl writable
    SolAccountInfo source;
    // #idl writable
    SolAccountInfo destination;
    // #idl writable
    SolAccountInfo metadata;
    // #idl writable
    SolAccountInfo ivy_wallet;
    // #idl writable
    SolAccountInfo curve_wallet;
    // #idl writable
    SolAccountInfo treasury_wallet;
    // #idl readonly
    SolAccountInfo ivy_mint;
    // #idl readonly
    SolAccountInfo metadata_program;
    // #idl readonly
    SolAccountInfo world;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl writable
    SolAccountInfo swap_alt;
    // #idl readonly
    SolAccountInfo alt_program;
    // #idl readonly
    SolAccountInfo system_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo ata_program;
} GameCreateAccounts;

// #idl instruction data game_create
typedef struct {
    bytes32 seed;
    bytes64 name;
    bytes16 symbol;
    bytes128 game_url;
    bytes128 cover_url;
    bytes128 metadata_url;
    u64 ivy_purchase;
    u64 min_game_received;
    u64 swap_alt_slot;
    u8 swap_alt_nonce;
    bool create_dest;
} GameCreateData;

// #idl instruction discriminator game_create
static const u64 GAME_CREATE_DISCRIMINATOR = UINT64_C(0x4f1ea41b5cbb8f52);

// #idl instruction declaration
static void game_create(
    const Context* ctx, const GameCreateAccounts* accounts, const GameCreateData* data
) {
    // Verify that our seeds match the game address
    // We MUST do this: see SECURITY.md
    slice game_seeds[2] = {
        slice_from_str(GAME_PREFIX), slice_from_bytes32(&data->seed)
    };
    address game_address = create_program_address(
        /* seeds */ game_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(game_seeds),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't create game program address"
    );
    require(address_equal(accounts->game.key, &game_address), "Incorrect game address");

    // Extract addresses
    address user = *accounts->user.key;

    // Create the game account via system program CPI
    system_create_account(
        /* ctx */ ctx,
        /* destination */ game_address,
        /* payer */ user,
        /* owner */ *ctx->program_id,
        /* size */ sizeof(Game),
        /* seeds */ game_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(game_seeds)
    );

    // Get liquidity info from World
    World* world = world_load(ctx, &accounts->world);

    // Initialize the Game structure
    Game* g = (Game*)accounts->game.data;
    g->discriminator = GAME_DISCRIMINATOR;
    g->owner = user;
    g->withdraw_authority = ADDRESS_ZERO;
    g->game_url = data->game_url;
    g->cover_url = data->cover_url;
    sol_memset(g->reserved, 0, sizeof(g->reserved));
    g->is_official_launch = false;
    g->seed = data->seed;

    // Create and store token mint (with user as temporary mint authority)
    slice mint_seeds[2] = {
        slice_from_str(GAME_MINT_PREFIX), slice_from_address(&game_address)
    };
    address mint_address = create_program_address(
        /* seeds */ mint_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(mint_seeds),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't create mint program address"
    );
    g->mint = mint_address;

    // Create mint with PDA seeds
    token_create_mint(
        /* ctx */ ctx,
        /* payer */ user,
        /* mint_address */ mint_address,
        /* mint_authority */ user,
        /* freeze_authority */ ADDRESS_ZERO,
        /* mint_seeds */ mint_seeds,
        /* mint_seeds_len */ SOL_ARRAY_SIZE(mint_seeds),
        /* decimals */ GAME_DECIMALS
    );

    // Create and store IVY wallet, its own authority
    slice ivy_wallet_seeds[2] = {
        slice_from_str(GAME_IVY_WALLET_PREFIX), slice_from_address(&game_address)
    };
    address ivy_wallet = create_program_address(
        /* seeds */ ivy_wallet_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(ivy_wallet_seeds),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't create ivy wallet program address"
    );
    g->ivy_wallet = ivy_wallet;

    token_create_account(
        /* ctx */ ctx,
        /* payer */ user,
        /* token_account */ ivy_wallet,
        /* mint_address */ world->ivy_mint,
        /* owner */ ivy_wallet,
        /* token_account_seeds */ ivy_wallet_seeds,
        /* token_account_seeds_len */ SOL_ARRAY_SIZE(ivy_wallet_seeds)
    );

    // Create and store curve wallet, its own authority
    slice curve_wallet_seeds[2] = {
        slice_from_str(GAME_CURVE_WALLET_PREFIX), slice_from_address(&game_address)
    };
    address curve_wallet = create_program_address(
        /* seeds */ curve_wallet_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(curve_wallet_seeds),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't create curve wallet program address"
    );
    g->curve_wallet = curve_wallet;

    token_create_account(
        /* ctx */ ctx,
        /* payer */ user,
        /* token_account */ curve_wallet,
        /* mint_address */ mint_address,
        /* owner */ curve_wallet,
        /* token_account_seeds */ curve_wallet_seeds,
        /* token_account_seeds_len */ SOL_ARRAY_SIZE(curve_wallet_seeds)
    );

    // Create and store treasury wallet, its own authority
    slice treasury_wallet_seeds[2] = {
        slice_from_str(GAME_TREASURY_WALLET_PREFIX), slice_from_address(&game_address)
    };
    address treasury_wallet = create_program_address(
        /* seeds */ treasury_wallet_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(treasury_wallet_seeds),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't create treasury wallet program address"
    );
    g->treasury_wallet = treasury_wallet;

    token_create_account(
        /* ctx */ ctx,
        /* payer */ user,
        /* token_account */ treasury_wallet,
        /* mint_address */ mint_address,
        /* owner */ treasury_wallet,
        /* token_account_seeds */ treasury_wallet_seeds,
        /* token_account_seeds_len */ SOL_ARRAY_SIZE(treasury_wallet_seeds)
    );

    // UTF-8 validation
    require(
        utf8_validate_zt(&data->name, sizeof(data->name)),
        "game name is not valid UTF-8"
    );
    require(
        utf8_validate_zt(&data->symbol, sizeof(data->symbol)),
        "game symbol is not valid UTF-8"
    );
    require(
        utf8_validate_zt(&data->game_url, sizeof(data->game_url)),
        "game URL is not valid UTF-8"
    );
    require(
        utf8_validate_zt(&data->cover_url, sizeof(data->cover_url)),
        "game cover URL is not valid UTF-8"
    );
    require(
        utf8_validate_zt(&data->metadata_url, sizeof(data->metadata_url)),
        "game metadata URL is not valid UTF-8"
    );

    // Create token metadata with game as update authority
    MetadataDataV2 metadata_data = {
        .name = slice_from_str_safe(&data->name, sizeof(data->name)),
        .symbol = slice_from_str_safe(&data->symbol, sizeof(data->symbol)),
        .uri = slice_from_str_safe(&data->metadata_url, sizeof(data->metadata_url))
    };

    metadata_create(
        /* ctx */ ctx,
        /* metadata_address */ *accounts->metadata.key,
        /* mint */ mint_address,
        /* mint_authority */ user,
        /* update_authority */ game_address,
        /* payer */ user,
        /* data */ &metadata_data
    );

    // Calculate how much user receives for initial purchase
    // (Initial purchases incur no fees)
    u64 game_received = cp_curve_exact_in(
        /* x */ world->ivy_initial_liquidity,
        /* y */ world->game_initial_liquidity,
        /* dx */ data->ivy_purchase
    );
    require(game_received >= data->min_game_received, "Slippage tolerance exceeded");

    // Store starting balances
    g->ivy_balance = safe_add_64(world->ivy_initial_liquidity, data->ivy_purchase);
    g->game_balance = safe_sub_64(world->game_initial_liquidity, game_received);

    if (data->ivy_purchase > 0) {
        // Collect purchase from user to IVY wallet
        token_transfer(
            /* ctx */ ctx,
            /* source */ *accounts->source.key,
            /* destination */ ivy_wallet,
            /* owner */ user,
            /* amount */ data->ivy_purchase
        );
    }

    // Mint starting balance to curve wallet
    token_mint(
        /* ctx */ ctx,
        /* mint_address */ mint_address,
        /* mint_authority */ user,
        /* destination */ curve_wallet,
        /* amount */ g->game_balance
    );

    if (game_received > 0) {
        if (data->create_dest && !token_exists(&accounts->destination)) {
            // Create destination wallet
            ata_create(
                /* ctx */ ctx,
                /* payer_address */ user,
                /* associated_token_address */ *accounts->destination.key,
                /* owner_address */ user,
                /* mint_address */ mint_address
            );
        }

        // Mint user purchase to destination wallet
        token_mint(
            /* ctx */ ctx,
            /* mint_address */ mint_address,
            /* mint_authority */ user,
            /* destination */ *accounts->destination.key,
            /* amount */ game_received
        );
    }

    // Set mint authority to null
    token_set_authority(
        /* ctx */ ctx,
        /* mint_or_token_account */ mint_address,
        /* kind */ TOKEN_AUTHORITY_MINT_TOKENS,
        /* authority */ user,
        /* new_authority */ ADDRESS_ZERO
    );

    // Create an Address Lookup Table for swap transactions
    // This allows swap instructions to use less bytes
    address swap_alt = *accounts->swap_alt.key;

    {
        // Prepare entries for ALT
        address entries[13] = {
            // Accounts directly required by game swaps
            game_address,
            ivy_wallet,
            curve_wallet,
            treasury_wallet,
            TOKEN_PROGRAM_ID,
            ATA_PROGRAM_ID,
            mint_address,
            world->ivy_mint,
            // Accounts required for emitting events
            *accounts->world.key,
            world->event_authority,
            // Accounts required for world swaps
            // (helps composite swaps)
            world->usdc_wallet,
            world->curve_wallet,
            // WSOL mint (helps when swapping SOL)
            WSOL_MINT,
        };

        // Set up the ALT
        setup_alt(
            /* ctx */ ctx,
            /* lookup_table */ swap_alt,
            /* authority */ game_address,
            /* payer */ user,
            /* entries */ entries,
            /* entries_len */ SOL_ARRAY_SIZE(entries),
            /* recent_slot */ data->swap_alt_slot,
            /* bump_seed */ data->swap_alt_nonce,
            /* authority_seeds */ game_seeds,
            /* authority_seeds_len */ SOL_ARRAY_SIZE(game_seeds)
        );
    }

    // Store swap ALT in game
    g->swap_alt = swap_alt;

    {
        // Emit create event as if no swap has occurred
        GameCreateEvent create_event = {
            .discriminator = GAME_CREATE_EVENT_DISCRIMINATOR,
            .game = game_address,
            .mint = mint_address,
            .swap_alt = swap_alt,
            .name = data->name,
            .symbol = data->symbol,
            .ivy_balance = world->ivy_initial_liquidity,
            .game_balance = world->game_initial_liquidity
        };

        event_emit(
            /* ctx */ ctx,
            /* event_data */ slice_new((const u8*)&create_event, sizeof(create_event)),
            /* global_address */ *accounts->world.key,
            /* event_authority */ world->event_authority,
            /* event_authority_nonce */ world->event_authority_nonce
        );
    }

    {
        // Emit edit event
        GameEditEvent edit_event = {
            .discriminator = GAME_EDIT_EVENT_DISCRIMINATOR,
            .game = game_address,
            .owner = user,
            .withdraw_authority = ADDRESS_ZERO,
            .game_url = data->game_url,
            .cover_url = data->cover_url,
            .metadata_url = data->metadata_url,
        };

        event_emit(
            /* ctx */ ctx,
            /* event_data */ slice_new((const u8*)&edit_event, sizeof(edit_event)),
            /* global_address */ *accounts->world.key,
            /* event_authority */ world->event_authority,
            /* event_authority_nonce */ world->event_authority_nonce
        );
    }

    if (game_received > 0) {
        // Emit swap event for initial purchase
        GameSwapEvent swap_event = {
            .discriminator = GAME_SWAP_EVENT_DISCRIMINATOR,
            .game = game_address,
            .user = user,
            .ivy_balance = g->ivy_balance,
            .game_balance = g->game_balance,
            .ivy_amount = data->ivy_purchase,
            .game_amount = game_received,
            .is_buy = true
        };

        event_emit(
            /* ctx */ ctx,
            /* event_data */ slice_new((const u8*)&swap_event, sizeof(swap_event)),
            /* global_address */ *accounts->world.key,
            /* event_authority */ world->event_authority,
            /* event_authority_nonce */ world->event_authority_nonce
        );
    }
}

/* ------------------------------ */

// #idl instruction accounts game_swap
typedef struct {
    // #idl writable
    SolAccountInfo game;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo source;
    // #idl writable
    SolAccountInfo destination;
    // #idl writable
    SolAccountInfo ivy_wallet;
    // #idl writable
    SolAccountInfo curve_wallet;
    // #idl writable
    SolAccountInfo treasury_wallet;
    // #idl readonly
    SolAccountInfo world;
    // #idl writable
    SolAccountInfo ivy_mint; // for burns
    // #idl readonly
    SolAccountInfo game_mint; // for ata_create_idempotent()
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo ata_program;
    // #idl readonly
    SolAccountInfo system_program;
} GameSwapAccounts;

// #idl instruction data game_swap
typedef struct {
    u64 amount;
    u64 threshold;
    bool is_buy;
    bool create_dest;
} GameSwapData;

// #idl instruction discriminator game_swap
static const u64 GAME_SWAP_DISCRIMINATOR = UINT64_C(0x3fa67d351a5577e6);

// #idl instruction declaration
static void game_swap(
    const Context* ctx, const GameSwapAccounts* accounts, const GameSwapData* data
) {
    Game* game = game_load(ctx, &accounts->game);
    World* world = world_load(ctx, &accounts->world);
    u64 amount = data->amount;

    address user = *accounts->user.key;
    address source_addr = *accounts->source.key;
    address destination_addr = *accounts->destination.key;

    // Define our relevant token pools
    address input_curve_wallet;
    address output_curve_wallet;
    u64 input_fee_bps;
    u64 output_fee_bps;
    u64 input_curve_balance;
    u64 output_curve_balance;
    slice output_wallet_seeds[2];

    // Setup based on swap direction
    if (data->is_buy) {
        // User is buying game tokens with IVY
        input_curve_wallet = game->ivy_wallet;
        output_curve_wallet = game->curve_wallet;
        input_fee_bps = world->ivy_fee_bps;
        output_fee_bps = world->game_fee_bps;
        input_curve_balance = game->ivy_balance;
        output_curve_balance = game->game_balance;
        output_wallet_seeds[0] = slice_from_str(GAME_CURVE_WALLET_PREFIX);
        output_wallet_seeds[1] =
            slice_from_address(accounts->game.key); // Use game key directly
    } else {
        // User is selling game tokens for IVY
        input_curve_wallet = game->curve_wallet;
        output_curve_wallet = game->ivy_wallet;
        input_fee_bps = world->game_fee_bps;
        output_fee_bps = world->ivy_fee_bps;
        input_curve_balance = game->game_balance;
        output_curve_balance = game->ivy_balance;
        output_wallet_seeds[0] = slice_from_str(GAME_IVY_WALLET_PREFIX);
        output_wallet_seeds[1] =
            slice_from_address(accounts->game.key); // Use game key directly
    }

    u64 user_pays; // Total amount user pays
    u64 amount_to_curve; // Amount that goes into the curve
    u64 input_fee_amount; // Fee taken from input
    u64 amount_from_curve; // Amount that comes out of the curve
    u64 output_fee_amount; // Fee taken from output
    u64 user_receives; // Total amount user receives

    // User provides an exact input amount
    user_pays = amount;

    // Calculate input fee and amount that goes to curve
    input_fee_amount = safe_mul_div_64(user_pays, input_fee_bps, 10000);
    amount_to_curve = safe_sub_64(user_pays, input_fee_amount);

    // Calculate output from curve
    amount_from_curve =
        cp_curve_exact_in(input_curve_balance, output_curve_balance, amount_to_curve);

    // Calculate output fee and net user receipt
    output_fee_amount = safe_mul_div_64(amount_from_curve, output_fee_bps, 10000);
    user_receives = safe_sub_64(amount_from_curve, output_fee_amount);

    // Validate amount against threshold
    require(user_receives >= data->threshold, "Slippage tolerance exceeded");

    // Update balances
    if (data->is_buy) {
        game->ivy_balance = safe_add_64(game->ivy_balance, amount_to_curve);
        game->game_balance = safe_sub_64(game->game_balance, amount_from_curve);
    } else {
        game->game_balance = safe_add_64(game->game_balance, amount_to_curve);
        game->ivy_balance = safe_sub_64(game->ivy_balance, amount_from_curve);
    }

    // Transfer input tokens from user to curve wallet
    token_transfer(
        /* ctx */ ctx,
        /* source */ source_addr,
        /* destination */ input_curve_wallet,
        /* owner */ user,
        /* amount */ amount_to_curve
    );

    // Handle input fee
    if (data->is_buy) {
        // Burn IVY fee
        token_burn(
            /* ctx */ ctx,
            /* token_account */ source_addr,
            /* mint_address */ world->ivy_mint,
            /* owner */ user,
            /* amount */ input_fee_amount
        );
    } else {
        // Send game token fee to treasury
        token_transfer(
            /* ctx */ ctx,
            /* source */ source_addr,
            /* destination */ game->treasury_wallet,
            /* owner */ user,
            /* amount */ input_fee_amount
        );
    }

    if (data->create_dest && !token_exists(&accounts->destination)) {
        // Create destination account
        ata_create(
            /* ctx */ ctx,
            /* payer_address */ user,
            /* associated_token_address */ destination_addr,
            /* owner_address */ user,
            /* mint_address */ data->is_buy ? game->mint : world->ivy_mint
        );
    }

    // Send output tokens from curve wallet to user
    token_transfer_signed(
        /* ctx */ ctx,
        /* source */ output_curve_wallet,
        /* destination */ destination_addr,
        /* owner */ output_curve_wallet,
        /* amount */ user_receives,
        /* owner_seeds */ output_wallet_seeds,
        /* owner_seeds_len */ SOL_ARRAY_SIZE(output_wallet_seeds)
    );

    // Handle output fee
    if (data->is_buy) {
        // Send game token fee to treasury
        token_transfer_signed(
            /* ctx */ ctx,
            /* source */ output_curve_wallet,
            /* destination */ game->treasury_wallet,
            /* owner */ output_curve_wallet,
            /* amount */ output_fee_amount,
            /* owner_seeds */ output_wallet_seeds,
            /* owner_seeds_len */ SOL_ARRAY_SIZE(output_wallet_seeds)
        );
    } else {
        // Burn IVY fee
        token_burn_signed(
            /* ctx */ ctx,
            /* token_account */ output_curve_wallet,
            /* mint_address */ world->ivy_mint,
            /* owner */ output_curve_wallet,
            /* amount */ output_fee_amount,
            /* owner_seeds */ output_wallet_seeds,
            /* owner_seeds_len */ SOL_ARRAY_SIZE(output_wallet_seeds)
        );
    }

    // Emit swap event
    GameSwapEvent swap_event = {
        .discriminator = GAME_SWAP_EVENT_DISCRIMINATOR,
        .game = *accounts->game.key,
        .user = *accounts->user.key,
        .ivy_balance = game->ivy_balance,
        .game_balance = game->game_balance,
        .ivy_amount = data->is_buy ? amount_to_curve : amount_from_curve,
        .game_amount = data->is_buy ? amount_from_curve : amount_to_curve,
        .is_buy = data->is_buy,
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

// #idl instruction accounts game_edit
typedef struct {
    // #idl writable
    SolAccountInfo game;
    // #idl signer
    SolAccountInfo owner;
    // #idl writable
    SolAccountInfo metadata;
    // #idl readonly
    SolAccountInfo metadata_program;
    // #idl readonly
    SolAccountInfo world;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
} GameEditAccounts;

// #idl instruction data game_edit
typedef struct {
    address new_owner;
    address new_withdraw_authority;
    bytes128 new_game_url;
    bytes128 new_cover_url;
    bytes128 new_metadata_url;
} GameEditData;

// #idl instruction discriminator game_edit
static const u64 GAME_EDIT_DISCRIMINATOR = UINT64_C(0xd41e9e63705d32ac);

// #idl instruction declaration
static void game_edit(
    const Context* ctx, const GameEditAccounts* accounts, const GameEditData* data
) {
    Game* game = game_load(ctx, &accounts->game);

    // Authorize
    authorize(&accounts->owner, game->owner);

    // Validate UTF-8
    require(
        utf8_validate_zt(&data->new_game_url, sizeof(data->new_game_url)),
        "new game URL is not valid UTF-8"
    );
    require(
        utf8_validate_zt(&data->new_cover_url, sizeof(data->new_cover_url)),
        "new cover URL is not valid UTF-8"
    );
    require(
        utf8_validate_zt(&data->new_metadata_url, sizeof(data->new_metadata_url)),
        "new metadata URL is not valid UTF-8"
    );

    // Update all fields
    game->owner = data->new_owner;
    game->withdraw_authority = data->new_withdraw_authority;
    game->game_url = data->new_game_url;
    game->cover_url = data->new_cover_url;

    // Load old metadata
    address metadata_addr = metadata_derive_address(game->mint);

    // Make sure that the user hasn't provided a fake metadata account
    require(
        address_equal(accounts->metadata.key, &metadata_addr),
        "Incorrect metadata provided"
    );

    MetadataDataV2 metadata_data;
    metadata_unpack(&accounts->metadata, &metadata_data);

    // Update data
    metadata_data.uri =
        slice_from_str_safe(&data->new_metadata_url, sizeof(data->new_metadata_url));

    // Send tx
    slice game_seeds[2] = {
        slice_from_str(GAME_PREFIX), slice_from_bytes32(&game->seed)
    };

    metadata_update_signed(
        /* ctx */ ctx,
        /* metadata_account */ metadata_addr,
        /* update_authority */ *accounts->game.key,
        /* new_update_authority */ *accounts->game.key,
        /* data */ &metadata_data,
        /* update_authority_seeds */ game_seeds,
        /* update_authority_seeds_len */ SOL_ARRAY_SIZE(game_seeds)
    );

    // Emit edit event
    GameEditEvent edit_event = {
        .discriminator = GAME_EDIT_EVENT_DISCRIMINATOR,
        .game = *accounts->game.key,
        .owner = game->owner,
        .withdraw_authority = game->withdraw_authority,
        .game_url = game->game_url,
        .cover_url = game->cover_url,
        .metadata_url = data->new_metadata_url,
    };

    // Load world to get event authority + nonce
    const World* world = world_load(ctx, &accounts->world);

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)&edit_event, sizeof(edit_event)),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

/* ------------------------------ */

// #idl instruction accounts game_credit
typedef struct {
    // #idl readonly
    SolAccountInfo game;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo source;
    // #idl writable
    SolAccountInfo treasury_wallet;
    // #idl readonly
    SolAccountInfo mint;
    // #idl readonly
    SolAccountInfo token_program;
} GameCreditAccounts;

// #idl instruction data game_credit
typedef struct {
    u64 amount;
} GameCreditData;

// #idl instruction discriminator game_credit
static const u64 GAME_CREDIT_DISCRIMINATOR = UINT64_C(0x193dd0eb9cf8b24f);

/// Called by any user, allows them to deposit funds
/// into the game's treasury wallet.
// #idl instruction declaration
static void game_credit(
    const Context* ctx, const GameCreditAccounts* accounts, const GameCreditData* data
) {
    const Game* game = game_load(ctx, &accounts->game);

    // Transfer tokens from user's source to treasury wallet
    token_transfer(
        /* ctx */ ctx,
        /* source */ *accounts->source.key,
        /* destination */ game->treasury_wallet,
        /* owner */ *accounts->user.key,
        /* amount */ data->amount
    );
}

/* ------------------------------ */

// #idl instruction accounts game_debit
typedef struct {
    // #idl readonly
    SolAccountInfo game;
    // #idl signer
    SolAccountInfo owner;
    // #idl writable
    SolAccountInfo treasury_wallet;
    // #idl writable
    SolAccountInfo destination;
    // #idl readonly
    SolAccountInfo mint;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo system_program;
    // #idl readonly
    SolAccountInfo ata_program;
} GameDebitAccounts;

// #idl instruction data game_debit
typedef struct {
    u64 amount;
    bool create_dest;
} GameDebitData;

// #idl instruction discriminator game_debit
static const u64 GAME_DEBIT_DISCRIMINATOR = UINT64_C(0x337b7b4e0dcf34b5);

/// Called by the owner, allows them to claim
/// funds from the game's treasury wallet.
// #idl instruction declaration
static void game_debit(
    const Context* ctx, const GameDebitAccounts* accounts, const GameDebitData* data
) {
    const Game* game = game_load(ctx, &accounts->game);

    // Verify authorization
    authorize(&accounts->owner, game->owner);

    // Get the wallet seeds for the treasury wallet
    address game_addr = *accounts->game.key;
    slice wallet_seeds[2] = {
        slice_from_str(GAME_TREASURY_WALLET_PREFIX), slice_from_address(&game_addr)
    };

    if (data->create_dest && !token_exists(&accounts->destination)) {
        // Create destination account
        ata_create(
            /* ctx */ ctx,
            /* payer_address */ game->owner,
            /* associated_token_address */ *accounts->destination.key,
            /* owner_address */ game->owner,
            /* mint_address */ game->mint
        );
    }

    // Send tokens from treasury wallet to the destination
    token_transfer_signed(
        /* ctx */ ctx,
        /* source */ game->treasury_wallet,
        /* destination */ *accounts->destination.key,
        /* owner */ game->treasury_wallet,
        /* amount */ data->amount,
        /* owner_seeds */ wallet_seeds,
        /* owner_seeds_len */ SOL_ARRAY_SIZE(wallet_seeds)
    );
}

/* ------------------------------ */

// #idl instruction accounts game_withdraw_claim
typedef struct {
    // #idl readonly
    SolAccountInfo game;
    // #idl writable
    SolAccountInfo treasury_wallet;
    // #idl writable
    SolAccountInfo destination;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo withdraw;
    // #idl readonly
    SolAccountInfo mint;
    // #idl readonly
    SolAccountInfo world;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo system_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo ata_program;
    // #idl readonly
    SolAccountInfo ix_sysvar;
} GameWithdrawClaimAccounts;

// #idl instruction data game_withdraw_claim
typedef struct {
    bytes32 id;
    bytes64 signature;
    bool create_dest;
} GameWithdrawClaimData;

// #idl instruction discriminator game_withdraw_claim
static const u64 GAME_WITHDRAW_CLAIM_DISCRIMINATOR = UINT64_C(0x7a40f291becde242);

/// Called by the user to claim a withdraw in game tokens.
/// To use this function:
/// - Generate 24 cryptographically random bytes,
///   and append the deposit amount in raw game tokens
///   to the end as a little endian u64, creating
///   a 32-byte ID.
/// - Sign the digest with the withdraw authority's secret key,
///   creating a 64-byte ed25519 signature.
/// - Give the ID and signature to the user. You're done!
///   The user will call this function (or not). You don't
///   have to worry about it.
/// - If you really want to see whether the user has claimed
///   the withdraw or not, watch for the withdraw event, or,
///   alternately, derive the withdraw PDA as findProgramAddress(
///       [GAME_WITHDRAW_PREFIX, game, id]
///   ) and repeatedly check for its existence.
/// - This function is idempotent; you can call it
///   multiple times with the same result.
// #idl instruction declaration
static void game_withdraw_claim(
    const Context* ctx,
    const GameWithdrawClaimAccounts* accounts,
    const GameWithdrawClaimData* data
) {
    // Load game
    Game* game = game_load(ctx, &accounts->game);

    // Verify user getting the withdraw has signed this TX
    require(accounts->user.is_signer, "User must sign `game_withdraw()`");

    // Verify provided signature
    u8 message[96];
    writer message_w = writer_new(message, sizeof(message));
    writer_write_address(&message_w, accounts->game.key);
    writer_write_address(&message_w, accounts->user.key);
    writer_write_bytes32(&message_w, &data->id);
    ed25519_verify(
        /* ix_info */ &accounts->ix_sysvar,
        /* msg */ slice_new(message, sizeof(message)),
        /* signature */ data->signature,
        /* public_key */ game->withdraw_authority
    );

    // Derive on-chain withdraw account for idempotency
    // (This account serves to mark whether the withdraw
    //  has been completed, to protect against double-spends)
    slice withdraw_seeds_pre[3] = {
        slice_from_str(GAME_WITHDRAW_PREFIX),
        slice_from_address(accounts->game.key),
        slice_from_bytes32(&data->id)
    };
    ProgramDerivedAddress withdraw_pda = find_program_address(
        /* seeds */ withdraw_seeds_pre,
        /* seeds_len */ SOL_ARRAY_SIZE(withdraw_seeds_pre),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't find withdraw account address"
    );
    // Ensure the user hasn't given us the wrong account
    require(
        address_equal(accounts->withdraw.key, &withdraw_pda.key),
        "Incorrect withdraw account provided"
    );
    // Ensure we haven't claimed this withdrawal before
    require(
        !account_exists(&accounts->withdraw), "Can't claim withdrawal: already claimed!"
    );

    // Extract amount from the ID (last 8 bytes, little endian u64)
    u64 amount = id_extract_amount(data->id);

    // Get the seeds for the treasury wallet PDA
    slice wallet_seeds[2] = {
        slice_from_str(GAME_TREASURY_WALLET_PREFIX),
        slice_from_address(accounts->game.key)
    };

    if (data->create_dest && !token_exists(&accounts->destination)) {
        // Create user's destination ATA if needed
        ata_create(
            /* ctx */ ctx,
            /* payer_address */ *accounts->user.key,
            /* associated_token_address */ *accounts->destination.key,
            /* owner_address */ *accounts->user.key,
            /* mint_address */ game->mint
        );
    }

    // Transfer tokens from treasury wallet to user destination
    token_transfer_signed(
        /* ctx */ ctx,
        /* source */ game->treasury_wallet,
        /* destination */ *accounts->destination.key,
        /* owner */ game->treasury_wallet,
        /* amount */ amount,
        /* owner_seeds */ wallet_seeds,
        /* owner_seeds_len */ SOL_ARRAY_SIZE(wallet_seeds)
    );

    // Derive full withdraw seeds including nonce
    slice withdraw_seeds[4] = {
        slice_from_str(GAME_WITHDRAW_PREFIX),
        slice_from_address(accounts->game.key),
        slice_from_bytes32(&data->id),
        slice_new(&withdraw_pda.nonce, 1)
    };
    // Create deposit account on-chain to prevent double withdraw
    system_create_account(
        /* ctx */ ctx,
        /* destination */ withdraw_pda.key,
        /* payer */ *accounts->user.key,
        /* owner */ *ctx->program_id,
        /* size */ 0,
        /* seeds */ withdraw_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(withdraw_seeds)
    );

    // Load world to get event authority + nonce
    const World* world = world_load(ctx, &accounts->world);

    // Emit withdraw event
    GameWithdrawEvent withdraw_event = {
        .discriminator = GAME_WITHDRAW_EVENT_DISCRIMINATOR,
        .game = *accounts->game.key,
        .id = data->id,
        .withdraw_authority = game->withdraw_authority
    };

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)&withdraw_event, sizeof(withdraw_event)),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

/* ------------------------------ */

// #idl instruction accounts game_burn_complete
typedef struct {
    // #idl readonly
    SolAccountInfo game;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo source;
    // #idl writable
    SolAccountInfo burn;
    // #idl readonly
    SolAccountInfo world;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo system_program;
} GameBurnCompleteAccounts;

// #idl instruction data game_burn_complete
typedef struct {
    bytes32 id;
} GameBurnCompleteData;

// #idl instruction discriminator game_burn_complete
static const u64 GAME_BURN_COMPLETE_DISCRIMINATOR = UINT64_C(0x532671b53bb710e0);

/// Called by the user to complete a burn of game tokens.
/// To use this function:
/// - Generate 24 cryptographically random bytes,
///   and append the burn amount in raw game tokens
///   to the end as a little endian u64, creating
///   a 32-byte ID.
/// - Give these bytes to the user, who will call this
///   function.
/// - Watch for the burn event, or, alternatively,
///   derive the burn PDA as findProgramAddress(
///       [GAME_BURN_PREFIX, game, id]
///   ) and repeatedly check for its existence.
/// - This function is idempotent; you can call it
///   multiple times with the same result.
// #idl instruction declaration
static void game_burn_complete(
    const Context* ctx,
    const GameBurnCompleteAccounts* accounts,
    const GameBurnCompleteData* data
) {
    // Load game
    const Game* game = game_load(ctx, &accounts->game);

    // Derive on-chain burn account
    // (This account serves to mark whether the burn
    //  has been completed, to protect against double-burns)
    slice burn_seeds_pre[3] = {
        slice_from_str(GAME_BURN_PREFIX),
        slice_from_address(accounts->game.key),
        slice_from_bytes32(&data->id)
    };
    ProgramDerivedAddress burn_pda = find_program_address(
        /* seeds */ burn_seeds_pre,
        /* seeds_len */ SOL_ARRAY_SIZE(burn_seeds_pre),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't find burn account address"
    );
    // Ensure the user hasn't given us the wrong account
    require(
        address_equal(accounts->burn.key, &burn_pda.key),
        "Incorrect burn account provided"
    );
    // Idempotency: ensure we haven't done this burn before
    if (account_exists(&accounts->burn)) {
        // we're good
        // (or there's a collision... not our fault!)
        return;
    }

    // Extract amount from the ID (last 8 bytes, little endian u64)
    u64 amount = id_extract_amount(data->id);

    // Burn tokens from user's account
    token_burn(
        /* ctx */ ctx,
        /* account */ *accounts->source.key,
        /* mint */ game->mint,
        /* owner */ *accounts->user.key,
        /* amount */ amount
    );

    // Derive full burn seeds
    slice burn_seeds[4] = {
        burn_seeds_pre[0],
        burn_seeds_pre[1],
        burn_seeds_pre[2],
        slice_new(&burn_pda.nonce, 1)
    };
    // Create burn account on-chain to prevent double burn
    system_create_account(
        /* ctx */ ctx,
        /* destination */ burn_pda.key,
        /* payer */ *accounts->user.key,
        /* owner */ *ctx->program_id,
        /* size */ 1,
        /* seeds */ burn_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(burn_seeds)
    );

    // Load world to get event authority + nonce
    const World* world = world_load(ctx, &accounts->world);

    // Emit burn event
    GameBurnEvent burn_event = {
        .discriminator = GAME_BURN_EVENT_DISCRIMINATOR,
        .game = *accounts->game.key,
        .id = data->id,
    };

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)&burn_event, sizeof(burn_event)),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

/* ------------------------------ */

// #idl instruction accounts game_deposit_complete
typedef struct {
    // #idl readonly
    SolAccountInfo game;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo source;
    // #idl writable
    SolAccountInfo treasury_wallet;
    // #idl writable
    SolAccountInfo deposit;
    // #idl readonly
    SolAccountInfo world;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo system_program;
} GameDepositCompleteAccounts;

// #idl instruction data game_deposit_complete
typedef struct {
    bytes32 id;
} GameDepositCompleteData;

// #idl instruction discriminator game_deposit_complete
static const u64 GAME_DEPOSIT_COMPLETE_DISCRIMINATOR = UINT64_C(0x47e2679db8fafdd3);

/// Called by the user to complete a deposit to the game.
/// To use this function:
/// - Generate 24 cryptographically random bytes,
///   and append the deposit amount in raw game tokens
///   to the end as a little endian u64, creating
///   a 32-byte ID.
/// - Give these bytes to the user, who will call this
///   function.
/// - Watch for the deposit event, or, alternatively,
///   derive the deposit PDA as findProgramAddress(
///       [GAME_DEPOSIT_PREFIX, game, id]
///   ) and repeatedly check for its existence.
/// - This function is idempotent; you can call it
///   multiple times with the same result.
// #idl instruction declaration
static void game_deposit_complete(
    const Context* ctx,
    const GameDepositCompleteAccounts* accounts,
    const GameDepositCompleteData* data
) {
    // Load game
    const Game* game = game_load(ctx, &accounts->game);

    // Derive on-chain deposit account
    // (This account serves to mark whether the deposit
    //  has been completed, to protect against double-spends)
    slice deposit_seeds_pre[3] = {
        slice_from_str(GAME_DEPOSIT_PREFIX),
        slice_from_address(accounts->game.key),
        slice_from_bytes32(&data->id)
    };
    ProgramDerivedAddress deposit_pda = find_program_address(
        /* seeds */ deposit_seeds_pre,
        /* seeds_len */ SOL_ARRAY_SIZE(deposit_seeds_pre),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't find deposit account address"
    );
    // Ensure the user hasn't given us the wrong account
    require(
        address_equal(accounts->deposit.key, &deposit_pda.key),
        "Incorrect deposit account provided"
    );
    // Ensure we haven't done this before
    require(
        !account_exists(&accounts->deposit), "Can't process deposit: already completed"
    );

    // Extract amount from the ID (last 8 bytes, little endian u64)
    u64 amount = id_extract_amount(data->id);

    // Ensure user has sufficient balance
    require(
        token_get_balance(&accounts->source) >= amount,
        "Insufficient token balance for deposit"
    );
    // Transfer tokens from user to treasury wallet
    token_transfer(
        /* ctx */ ctx,
        /* source */ *accounts->source.key,
        /* destination */ game->treasury_wallet,
        /* owner */ *accounts->user.key,
        /* amount */ amount
    );

    // Derive full deposit seeds
    slice deposit_seeds[4] = {
        deposit_seeds_pre[0],
        deposit_seeds_pre[1],
        deposit_seeds_pre[2],
        slice_new(&deposit_pda.nonce, 1)
    };
    // Create deposit account on-chain to prevent double spend
    system_create_account(
        /* ctx */ ctx,
        /* destination */ deposit_pda.key,
        /* payer */ *accounts->user.key,
        /* owner */ *ctx->program_id,
        /* size */ 0,
        /* seeds */ deposit_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(deposit_seeds)
    );

    // Load world to get event authority + nonce
    const World* world = world_load(ctx, &accounts->world);

    // Emit deposit event
    GameDepositEvent deposit_event = {
        .discriminator = GAME_DEPOSIT_EVENT_DISCRIMINATOR,
        .game = *accounts->game.key,
        .id = data->id,
    };

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)&deposit_event, sizeof(deposit_event)),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

/* ------------------------------ */

// #idl instruction accounts game_promote
typedef struct {
    // #idl writable
    SolAccountInfo game;
    // #idl readonly
    SolAccountInfo world;
    // #idl signer
    SolAccountInfo world_owner;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
} GamePromoteAccounts;

// #idl instruction data game_promote
typedef struct {
} GamePromoteData;

// #idl instruction discriminator game_promote
static const u64 GAME_PROMOTE_DISCRIMINATOR = UINT64_C(0x5fb965d257be44eb);

/// Promote this game to an official launch!
// #idl instruction declaration
static void game_promote(
    const Context* ctx, const GamePromoteAccounts* accounts, const GamePromoteData* data
) {
    Game* game = game_load(ctx, &accounts->game);
    const World* world = world_load(ctx, &accounts->world);

    // Ensure authorization
    authorize(&accounts->world_owner, world->owner);

    // Promote game
    game->is_official_launch = true;

    // Emit promote event
    GamePromoteEvent promote_event = {
        .discriminator = GAME_PROMOTE_EVENT_DISCRIMINATOR,
        .game = *accounts->game.key,
    };

    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)&promote_event, sizeof(promote_event)),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

#endif /* IVY_GAME_H */
