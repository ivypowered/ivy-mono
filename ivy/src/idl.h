#ifndef IVY_IDL_H
#define IVY_IDL_H

#include "safe_math.h"
#include "util.h"
#include "lib/context.h"
#include "lib/heap.h"
#include "lib/rent.h"
#include "lib/rw.h"
#include "lib/system.h"
#include "lib/types.h"
#include <solana_sdk.h>

/*
   This file implements the Anchor framework's
   IDL on-chain storage logic, which can be found
   at https://github.com/solana-foundation/anchor/blob/master/lang/syn/src/codegen/program/idl.rs.

   This is not strictly necessary, but on-chain IDL storage
   allows block explorers to easily deserialize instructions
   so that they can be displayed to the user.
 */

// === Constants ===

// Sha256(anchor:idl)[..8]
static const u64 IDL_IX_TAG = UINT64_C(0x0a69e9a778bcf440);
// IdlAccount discriminator
// Split into two 32-bit parts
// This is so that IdlAccount alignment can be 4
// and we can avoid any padding
static const u32 IDL_DISC_PT1 = 0xbf624618;
static const u32 IDL_DISC_PT2 = 0x9e7b903a;

// === Structs ===

// Represents the data stored in an IDL account
typedef struct {
    u32 disc_pt1; // Must be IDL_DISC_PT1
    u32 disc_pt2; // Must be IDL_DISC_PT2
    address authority;
    u32 data_len; // Length of compressed IDL bytes that follow
    u8 data[]; // Variable length array for IDL data
} IdlAccount;

// Instruction tags
typedef enum {
    IDL_IX_CREATE = 0,
    IDL_IX_CREATE_BUFFER = 1,
    IDL_IX_WRITE = 2,
    IDL_IX_SET_BUFFER = 3,
    IDL_IX_SET_AUTHORITY = 4,
    IDL_IX_CLOSE = 5,
    IDL_IX_RESIZE = 6
} IdlInstructionTag;

// === Helper Functions ===

static const char* IDL_SEED = "anchor:idl";

// Gets the canonical address for a program's IDL account
static address idl_derive_address(address base, address program_id) {
    // Create with seed: program_signer + "anchor:idl" + program_id
    SolBytes parts[3] = {
        {.addr = base.x, .len = sizeof(base.x)},
        {.addr = (const u8*)IDL_SEED, .len = sol_strlen(IDL_SEED)},
        {.addr = program_id.x, .len = sizeof(base.x)}
    };

    address result;
    sol_sha256(parts, SOL_ARRAY_SIZE(parts), result.x);
    return result;
}

// Get IdlAccount data pointer and verify discriminator
static IdlAccount* idl_load_account(const Context* ctx, const SolAccountInfo* account) {
    // See SECURITY.md for more details
    // 1. Ensure account ownership
    require(
        address_equal(ctx->program_id, account->owner), "Incorrect IdlAccount owner"
    );
    // 2. Ensure data is of necessary length
    require(
        account->data_len >= sizeof(IdlAccount), "Provided IdlAccount data too small"
    );
    IdlAccount* idl = (IdlAccount*)(account->data);
    // 3. Verify discriminator
    require(
        idl->disc_pt1 == IDL_DISC_PT1 && idl->disc_pt2 == IDL_DISC_PT2,
        "Invalid IDL account discriminator"
    );
    return idl;
}

// === IDL Instruction Handlers ===

// __idl_create_account: Creates the canonical IDL account
static void idl_create_account(Context* ctx, const u8* data, u64 data_len) {
    sol_log("Instruction: IdlCreateAccount");

    // Parse accounts
    require(ctx->ka_num >= 2, "Not enough accounts for IDL create");
    const SolAccountInfo* from = &ctx->ka[0];
    const SolAccountInfo* to = &ctx->ka[1];

    // Parse data length from instruction data
    require(data_len >= 8, "Invalid instruction data");
    const u64 idl_len = *((u64*)(data));

    // Find PDA for create_with_seed
    ProgramDerivedAddress base = find_program_address(NULL, 0, *ctx->program_id, "");

    // Create account with seed
    address to_address = idl_derive_address(base.key, *ctx->program_id);

    // Calculate space (capped at 10,000 bytes)
    u64 space = sizeof(IdlAccount) + idl_len;
    if (space > 10000) {
        space = 10000;
    }

    u64 lamports = minimum_balance(space);

    // Create the account
    const slice base_seeds[1] = {slice_new(&base.nonce, 1)};
    system_create_account_with_seed(
        /* ctx */ ctx,
        /* from */ *from->key,
        /* to */ to_address,
        /* base */ base.key,
        /* seed */ IDL_SEED,
        /* lamports */ lamports,
        /* space */ space,
        /* owner */ *ctx->program_id,
        /* base_seeds */ base_seeds,
        /* base_seeds_len */ SOL_ARRAY_SIZE(base_seeds)
    );

    // Verify untrusted account
    require(address_equal(to->key, &to_address), "Invalid to account");

    // Initialize the account
    IdlAccount* idl = (IdlAccount*)to->data;
    idl->disc_pt1 = IDL_DISC_PT1;
    idl->disc_pt2 = IDL_DISC_PT2;
    idl->authority = *from->key;
    idl->data_len = 0;
}

// __idl_resize_account: Resizes the IDL account to accommodate larger data
static void idl_resize_account(Context* ctx, const u8* data, u64 data_len) {
    sol_log("Instruction: IdlResizeAccount");

    // Parse accounts
    require(ctx->ka_num >= 2, "Not enough accounts for IDL resize");
    SolAccountInfo* idl_info = &ctx->ka[0];
    const SolAccountInfo* authority = &ctx->ka[1];

    // Parse data length
    require(data_len >= 8, "Invalid instruction data");
    const u64 idl_data_len = *(u64*)(data);

    // Verify authority
    IdlAccount* idl = idl_load_account(ctx, idl_info);
    authorize(authority, idl->authority);

    // We don't support resizing accounts that already contain data
    require(idl->data_len == 0, "IdlAccountNotEmpty");

    // Calculate new space needed
    u64 curr_space = idl_info->data_len;
    u64 additional_space = idl_data_len > 10000 ? 10000 : idl_data_len;
    u64 new_space = curr_space + additional_space;

    // Realloc the IDL account
    sol_realloc(idl_info, new_space);

    // Transfer additional lamports
    u64 min_balance = minimum_balance(new_space);
    u64 balance = *idl_info->lamports;
    if (min_balance > balance) {
        system_transfer(
            /* ctx */ ctx,
            /* from */ *authority->key,
            /* to */ *idl_info->key,
            /* lamports */ min_balance - balance
        );
    }
}

// __idl_close_account: Closes an IDL account
static void idl_close_account(Context* ctx, const u8* data, u64 data_len) {
    sol_log("Instruction: IdlCloseAccount");

    // Parse accounts
    require(ctx->ka_num >= 3, "Not enough accounts for IDL close");
    SolAccountInfo* account = &ctx->ka[0];
    const SolAccountInfo* authority = &ctx->ka[1];
    const SolAccountInfo* destination = &ctx->ka[2];

    // Verify authority
    IdlAccount* idl = idl_load_account(ctx, account);
    authorize(authority, idl->authority);

    // Close account on-chain
    sol_close_account(account, destination);
}

// Is the provided block all zeroes?
static bool memiszero(const void* blk, u64 len) {
    const u8* b = (const u8*)blk;
    for (u64 i = 0; i < len; i++) {
        if (b[i] != 0) {
            return false;
        }
    }
    return true;
}

// __idl_create_buffer: Creates a buffer IDL account
static void idl_create_buffer(Context* ctx) {
    sol_log("Instruction: IdlCreateBuffer");

    // Parse accounts
    require(ctx->ka_num >= 2, "Not enough accounts for IDL create buffer");
    const SolAccountInfo* buffer = &ctx->ka[0];
    const SolAccountInfo* authority = &ctx->ka[1];

    // Verify authority is signer
    require(authority->is_signer, "Authority must be signer");

    // Verify buffer is uninitialized
    // (Not doing this would allow anyone to overwrite canonical IDL accounts,
    // buffers, etc.)
    require(
        memiszero(buffer->data, buffer->data_len),
        "Buffer account passed to IdlCreateBuffer must be uninitialized"
    );

    // Initialize buffer
    IdlAccount* idl = (IdlAccount*)buffer->data;
    idl->disc_pt1 = IDL_DISC_PT1;
    idl->disc_pt2 = IDL_DISC_PT2;
    idl->authority = *authority->key;
    idl->data_len = 0;
}

// __idl_write: Writes IDL data to an account
static void idl_write(Context* ctx, const u8* data, u64 data_len) {
    sol_log("Instruction: IdlWrite");

    // Parse accounts
    require(ctx->ka_num >= 2, "Not enough accounts for IDL write");
    const SolAccountInfo* idl_info = &ctx->ka[0];
    const SolAccountInfo* authority = &ctx->ka[1];

    // Verify authority
    IdlAccount* idl = idl_load_account(ctx, idl_info);
    authorize(authority, idl->authority);

    // Parse idl data segment
    require(data_len >= 4, "Invalid instruction data");
    const u32 segment_len = *(u32*)data;
    const u8* segment_data = data + 4;

    // Ensure there's enough data in the instruction
    require(data_len >= 4 + segment_len, "Instruction data too short");

    // Calculate new total length
    u32 prev_len = idl->data_len;
    u32 new_len = prev_len + segment_len;

    // Ensure there's enough space in the account
    require(
        idl_info->data_len >= sizeof(IdlAccount) + new_len,
        "Not enough space in IDL account"
    );

    // Copy the data segment
    sol_memcpy(idl->data + prev_len, segment_data, segment_len);
    idl->data_len = new_len;
}

// __idl_set_authority: Changes the IDL account authority
static void idl_set_authority(Context* ctx, const u8* data, u64 data_len) {
    sol_log("Instruction: IdlSetAuthority");

    // Parse accounts
    require(ctx->ka_num >= 2, "Not enough accounts for IDL set authority");
    const SolAccountInfo* idl_info = &ctx->ka[0];
    const SolAccountInfo* authority = &ctx->ka[1];

    // Verify authority
    IdlAccount* idl = idl_load_account(ctx, idl_info);
    authorize(authority, idl->authority);

    // Parse new authority
    require(data_len >= sizeof(address), "Invalid instruction data");
    address new_authority = *(address*)(data);

    // Set new authority
    idl->authority = new_authority;
}

// __idl_set_buffer: Copies IDL data from buffer to the canonical account
static void idl_set_buffer(Context* ctx) {
    sol_log("Instruction: IdlSetBuffer");

    // Parse accounts
    require(ctx->ka_num >= 3, "Not enough accounts for IDL set buffer");
    const SolAccountInfo* buffer_info = &ctx->ka[0];
    const SolAccountInfo* idl_info = &ctx->ka[1];
    const SolAccountInfo* authority = &ctx->ka[2];

    // Verify authorities
    IdlAccount* idl = idl_load_account(ctx, idl_info);
    IdlAccount* buffer = idl_load_account(ctx, buffer_info);
    authorize(authority, idl->authority);
    authorize(authority, buffer->authority);

    // Copy buffer data to IDL account
    u32 buffer_len = buffer->data_len;
    require(
        idl_info->data_len >= sizeof(IdlAccount) + buffer_len,
        "IDL account too small for buffer"
    );

    sol_memcpy(idl->data, buffer->data, buffer_len);
    idl->data_len = buffer_len;
}

// Main IDL instruction dispatcher
static void idl_dispatch(Context* ctx) {
    require(ctx->data_len >= 9, "Instruction data too short");
    require(*(u64*)ctx->data == IDL_IX_TAG, "Invalid IX tag");
    u8 tag = ctx->data[8];
    const u8* data = &ctx->data[9];
    u64 data_len = ctx->data_len - 9;
    switch (tag) {
        case IDL_IX_CREATE:
            idl_create_account(ctx, data, data_len);
            break;
        case IDL_IX_CREATE_BUFFER:
            idl_create_buffer(ctx);
            break;
        case IDL_IX_WRITE:
            idl_write(ctx, data, data_len);
            break;
        case IDL_IX_SET_BUFFER:
            idl_set_buffer(ctx);
            break;
        case IDL_IX_SET_AUTHORITY:
            idl_set_authority(ctx, data, data_len);
            break;
        case IDL_IX_CLOSE:
            idl_close_account(ctx, data, data_len);
            break;
        case IDL_IX_RESIZE:
            idl_resize_account(ctx, data, data_len);
            break;
        default:
            require(false, "Invalid IDL instruction");
    }
}

#endif // IVY_IDL_H
