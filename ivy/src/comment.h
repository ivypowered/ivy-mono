#ifndef IVY_COMMENT_H
#define IVY_COMMENT_H

#include "game.h"
#include <ivy-lib/context.h>
#include <ivy-lib/system.h>
#include <ivy-lib/types.h>
#include <ivy-lib/utf8.h>

/**
 * On-chain comment storage
 *
 * Each game can have one CommentIndex, which keeps track
 * of the list of comment buffers.
 *
 * When a user wants to add a comment, they append
 * - 1) their 32-byte address
 * - 2) the current timestamp
 * - 3) their zero-terminated comment
 * to the last comment buffer in the list, and emit a CommentEvent.
 *
 * To fetch comments, you have two options:
 * 1) Get the accounts from on-chain and read the data
 * 2) Listen for CommentEvents in realtime and construct the full
 *    comment stream
 */

static const char* const COMMENT_INDEX_PREFIX = "comment_index";
static const char* const COMMENT_BUFFER_PREFIX = "comment_buffer";
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
    u64 buf_index;
    // #idl string
    AnchorString text;
} CommentEvent;

// #idl event discriminator CommentEvent
static const u64 COMMENT_EVENT_DISCRIMINATOR = UINT64_C(0x2d4150b25ba4e2b0);

// #idl struct declaration
typedef struct {
    u64 discriminator;

    /// The address of the current comment buffer.
    address buf_address;
    /// The game this comment index is for.
    address game;
    /// The total number of comments for this game.
    u64 total_count;
    /// The index of the current comment buffer.
    u64 buf_index;
    /// The nonce of the current comment buffer.
    u8 buf_nonce;
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

static ProgramDerivedAddress comment_buffer_derive_pda(
    address program_id, address game, u64 index
) {
    slice seeds[3] = {
        slice_from_str(COMMENT_BUFFER_PREFIX),
        slice_from_address(&game),
        slice_new((u8*)&index, sizeof(index))
    };
    ProgramDerivedAddress cb_pda = find_program_address(
        /* seeds */ seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(seeds),
        /* program_id */ program_id,
        /* msg */ "can't find comment buffer"
    );
    return cb_pda;
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
    // #idl writable
    SolAccountInfo cb_cur;
    // #idl writable
    SolAccountInfo cb_next;
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
    // Critical: We store comments as null-terminated strings,
    //           so zeroes inside the comment would corrupt
    //           our storage format
    require(
        sol_memchr(data->text.data, 0, data->text.len) == NULL,
        "Comment has null terminator inside"
    );

    // 2. Compute storage requirements
    // Each comment is stored as
    //  [index][address][timestamp][text][null_terminator]
    u64 comment_len = sizeof(u64) // index
        + sizeof(address) // user
        + sizeof(u64) // timestamp
        + data->text.len // comment text
        + 1 // null terminator
        ;

    // 3. Load comment index, or create it if it does not exist
    CommentIndex* ci;
    if (account_exists(&accounts->ci)) {
        ci = comment_index_load(ctx, &accounts->ci);
    } else {
        // Ensure game exists and is valid
        game_load(ctx, &accounts->game);

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

        // Create the game account via system program CPI
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

        // Derive index 0 comment buffer
        ProgramDerivedAddress cb_pda = comment_buffer_derive_pda(
            /* program_id */ *ctx->program_id,
            /* game */ *accounts->game.key,
            /* index */ 0
        );

        // Initialize the CommentIndex structure
        ci = (CommentIndex*)accounts->ci.data;
        ci->discriminator = COMMENT_INDEX_DISCRIMINATOR;
        ci->buf_address = cb_pda.key;
        ci->game = *accounts->game.key;
        ci->total_count = 0;
        ci->buf_index = 0;
        ci->buf_nonce = cb_pda.nonce;
    }

    // 4. Handle buffer selection
    // Due to Solana's account model, users must calculate off-chain
    // which buffers to pass our program. But, this can lead to outdated
    // data. So, we accept two buffers: `cb_cur`, and an alternate, `cb_next`.
    // We have 5 scenarios
    // a) current buffer is `cb_cur`, has space -> use it
    // b) current buffer is `cb_cur`, is full -> use `cb_next`
    // c) current buffer is `cb_next`, has space -> use it
    // d) current buffer is `cb_next`, is full -> fail
    // e) current buffer is not `cb_cur`, not `cb_next` -> fail
    SolAccountInfo* target;
    if (address_equal(&ci->buf_address, accounts->cb_cur.key)) {
        // Let's try `cb_cur`, if that doesn't work, we'll use `cb_next`.
        target = &accounts->cb_cur;
        if ((target->data_len + comment_len) > MAX_PERMITTED_DATA_LENGTH) {
            // This comment won't fit, we must switch to the next buffer!
            require(
                !account_exists(&accounts->cb_next),
                "state inconsistency: next comment buffer created before current was completed!"
            );
            ProgramDerivedAddress cb_pda = comment_buffer_derive_pda(
                /* program_id */ *ctx->program_id,
                /* game */ ci->game,
                /* index */ ci->buf_index + 1
            );
            require(
                address_equal(accounts->cb_next.key, &cb_pda.key),
                "Invalid next comment buffer"
            );
            ci->buf_index++;
            ci->buf_address = cb_pda.key;
            ci->buf_nonce = cb_pda.nonce;
            target = &accounts->cb_next;
        }
    } else if (address_equal(&ci->buf_address, accounts->cb_next.key)) {
        // Let's try `cb_next`; if that doesn't work, we have no recourse.
        target = &accounts->cb_next;
        require(
            (target->data_len + comment_len) <= MAX_PERMITTED_DATA_LENGTH,
            "outdated comment buffer (cb_next has no more space)"
        );
    } else {
        require(false, "outdated or incorrect comment buffer provided");
    }

    // 5. Ensure target buffer exists + has space
    u64 target_old_len = target->data_len;
    u64 target_new_len = target_old_len + comment_len;
    if (*target->lamports == 0) {
        // Comment buffer must be created
        slice cb_seeds[4] = {
            slice_from_str(COMMENT_BUFFER_PREFIX),
            slice_from_address(&ci->game),
            slice_new((const u8*)&ci->buf_index, sizeof(ci->buf_index)),
            slice_new(&ci->buf_nonce, sizeof(ci->buf_nonce))
        };

        system_create_account(
            /* ctx */ ctx,
            /* destination */ *target->key,
            /* payer */ *accounts->user.key,
            /* owner */ *ctx->program_id,
            /* size */ target_new_len,
            /* seeds */ cb_seeds,
            /* seeds_len */ SOL_ARRAY_SIZE(cb_seeds)
        );

        sol_refresh_data_len(target);
    } else {
        // Comment buffer just needs a realloc
        sol_realloc(target, target_new_len);
        // Ensure rent-exemption
        u64 required_lamports = minimum_balance(target_new_len);
        u64 actual_lamports = *target->lamports;
        if (actual_lamports < required_lamports) {
            system_transfer(
                /* ctx */ ctx,
                /* from */ *accounts->user.key,
                /* to */ *target->key,
                /* amount */ required_lamports - actual_lamports
            );
        }
    }

    // 6. Write comment data
    // format: [index][32-byte address][8-byte timestamp][text][null terminator]

    // Get comment index, and increment total
    u64 comment_index = ci->total_count++;

    // Get current time
    Clock clock;
    require(sol_get_clock_sysvar(&clock) == 0, "can't get clock sysvar");
    require(clock.unix_timestamp > 0, "invalid clock unix timestamp");

    // Write comment (address user, u64 len, u8[] data)
    writer w = writer_new(target->data, target->data_len);
    writer_skip(&w, target_old_len);
    writer_write_u64(&w, comment_index); // index
    writer_write_address(&w, accounts->user.key); // address
    writer_write_u64(&w, clock.unix_timestamp); // timestamp
    writer_write_slice(&w, slice_new(data->text.data, data->text.len)); // text
    writer_write_u8(&w, 0); // zero terminator

    // Prepare comment event
    u64 comment_event_len = sizeof(CommentEvent) + data->text.len;
    CommentEvent* evt = (CommentEvent*)heap_alloc(comment_event_len);
    evt->discriminator = COMMENT_EVENT_DISCRIMINATOR;
    evt->game = ci->game;
    evt->user = *accounts->user.key;
    evt->comment_index = comment_index;
    evt->timestamp = clock.unix_timestamp;
    evt->buf_index = ci->buf_index;
    evt->text.len = data->text.len;
    sol_memcpy(evt->text.data, data->text.data, data->text.len);

    // 7. Emit comment event for real-time listeners
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
