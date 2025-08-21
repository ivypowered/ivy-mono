#ifndef IVY_COMMENT_H
#define IVY_COMMENT_H

#include "game.h"
#include "sync.h"
#include <ivy-lib/context.h>
#include <ivy-lib/system.h>
#include <ivy-lib/types.h>
#include <ivy-lib/utf8.h>

/**
 * On-chain comment tracking with event-based storage
 *
 * Each game can have one CommentIndex, which keeps track
 * of the total number of comments.
 *
 * When a user wants to add a comment, the contract:
 * - Increments the comment counter
 * - Emits a CommentEvent with the comment data
 *
 * To fetch comments, listen for CommentEvents in realtime
 * and construct the full comment stream.
 */

static const char* const COMMENT_INDEX_PREFIX = "comment_index";
static const u64 COMMENT_MAX_LEN = 280;

/// An Anchor string (length followed by data)
typedef struct {
    u32 len;
    u8 data[];
} AnchorString;

// #idl event declaration
typedef struct {
    u64 discriminator;
    address game;
    address user;
    u64 comment_index;
    u64 timestamp;
    // #idl string
    AnchorString text;
} CommentEvent;

// #idl event discriminator CommentEvent
static const u64 COMMENT_EVENT_DISCRIMINATOR = UINT64_C(0x2d4150b25ba4e2b0);

// #idl struct declaration
typedef struct {
    u64 discriminator;
    /// The game this comment index is for.
    address game;
    /// The total number of comments for this game.
    u64 total_count;
} CommentIndex;

// #idl struct discriminator CommentIndex
static const u64 COMMENT_INDEX_DISCRIMINATOR = UINT64_C(0x114bed0381ec71bd);

static CommentIndex* comment_index_load(
    const Context* ctx, const SolAccountInfo* comment_index
) {
    // See SECURITY.md for more details
    // 1. Ensure account ownership
    require(
        address_equal(ctx->program_id, comment_index->owner),
        "Incorrect CommentIndex account owner"
    );
    // 2. Ensure data is of necessary length
    require(
        comment_index->data_len >= sizeof(CommentIndex),
        "Provided CommentIndex account data too small"
    );
    CommentIndex* ci = (CommentIndex*)comment_index->data;
    // 3. Verify discriminator
    require(
        ci->discriminator == COMMENT_INDEX_DISCRIMINATOR,
        "Provided CommentIndex discriminator incorrect"
    );
    return ci;
}

// #idl instruction accounts comment_post
typedef struct {
    // #idl writable
    SolAccountInfo ci;
    // #idl readonly
    SolAccountInfo game;
    // #idl signer
    SolAccountInfo user;
    // #idl readonly
    SolAccountInfo world;
    // #idl readonly
    SolAccountInfo this_program;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo system_program;
} CommentPostAccounts;

// #idl instruction data comment_post
typedef struct {
    // #idl string
    AnchorString text;
} CommentPostData;

// #idl instruction discriminator comment_post
static const u64 COMMENT_POST_DISCRIMINATOR = UINT64_C(0xb3221f55cd8c3438);

// #idl instruction declaration
static void comment_post(
    const Context* ctx,
    CommentPostAccounts* accounts,
    const CommentPostData* data,
    u64 data_len
) {
    // 1. Input validation
    require(data->text.len > 0, "Comment must not be empty");
    require(
        data_len >= sizeof(AnchorString) &&
            data->text.len <= data_len - sizeof(AnchorString),
        "Comment length inconsistent with passed data size"
    ); // ensure `data.len` does not exceed out of bounds
    require(data->text.len <= COMMENT_MAX_LEN, "Comment too long");
    require(utf8_validate(data->text.data, data->text.len), "Comment not valid UTF-8");

    // 2. Load comment index, or create it if it does not exist
    CommentIndex* ci;
    if (account_exists(&accounts->ci)) {
        ci = comment_index_load(ctx, &accounts->ci);
    } else {
        // Ensure game exists and is valid
        require(
            game_is_valid(ctx, &accounts->game) || sync_is_valid(ctx, &accounts->game),
            "Parameter `game` in comment_post must be of type Game or Sync"
        );

        // Verify that our seeds match the comment index address
        // We MUST do this: see SECURITY.md
        slice ci_pre_seeds[2] = {
            slice_from_str(COMMENT_INDEX_PREFIX), slice_from_address(accounts->game.key)
        };
        ProgramDerivedAddress ci_pda = find_program_address(
            /* seeds */ ci_pre_seeds,
            /* seeds_len */ SOL_ARRAY_SIZE(ci_pre_seeds),
            /* program_id */ *ctx->program_id,
            /* msg */ "Can't create comment index address"
        );
        address ci_address = ci_pda.key;
        require(
            address_equal(accounts->ci.key, &ci_address),
            "Incorrect comment index address"
        );

        // Create the comment index account via system program CPI
        slice ci_seeds[3] = {
            ci_pre_seeds[0],
            ci_pre_seeds[1],
            slice_new(&ci_pda.nonce, sizeof(ci_pda.nonce))
        };
        system_create_account(
            /* ctx */ ctx,
            /* destination */ ci_address,
            /* payer */ *accounts->user.key,
            /* owner */ *ctx->program_id,
            /* size */ sizeof(CommentIndex),
            /* seeds */ ci_seeds,
            /* seeds_len */ SOL_ARRAY_SIZE(ci_seeds)
        );

        // Initialize the CommentIndex structure
        ci = (CommentIndex*)accounts->ci.data;
        ci->discriminator = COMMENT_INDEX_DISCRIMINATOR;
        ci->game = *accounts->game.key;
        ci->total_count = 0;
    }

    // 3. Get comment index and increment total
    u64 comment_index = ci->total_count++;

    // 4. Get current time
    Clock clock;
    require(sol_get_clock_sysvar(&clock) == 0, "can't get clock sysvar");
    require(clock.unix_timestamp > 0, "invalid clock unix timestamp");

    // 5. Prepare and emit comment event
    u64 comment_event_len = sizeof(CommentEvent) + data->text.len;
    CommentEvent* evt = (CommentEvent*)heap_alloc(comment_event_len);
    evt->discriminator = COMMENT_EVENT_DISCRIMINATOR;
    evt->game = ci->game;
    evt->user = *accounts->user.key;
    evt->comment_index = comment_index;
    evt->timestamp = clock.unix_timestamp;
    evt->text.len = data->text.len;
    sol_memcpy(evt->text.data, data->text.data, data->text.len);

    const World* world = world_load(ctx, &accounts->world);
    event_emit(
        /* ctx */ ctx,
        /* event_data */ slice_new((const u8*)evt, comment_event_len),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

#endif
