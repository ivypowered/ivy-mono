#ifndef IVY_TOKEN_H
#define IVY_TOKEN_H

#include "context.h"
#include "rw.h"
#include "system.h"
#include "types.h"
#include <solana_sdk.h>

// === Enums ===

typedef enum {
    TOKEN_ACCOUNT_STATE_UNINITIALIZED,
    TOKEN_ACCOUNT_STATE_INITIALIZED,
    TOKEN_ACCOUNT_STATE_FROZEN
} TokenAccountState;

typedef enum {
    TOKEN_AUTHORITY_MINT_TOKENS,
    TOKEN_AUTHORITY_FREEZE_ACCOUNT,
    TOKEN_AUTHORITY_ACCOUNT_OWNER,
    TOKEN_AUTHORITY_CLOSE_ACCOUNT
} TokenAuthority;

typedef enum {
    TOKEN_INSTRUCTION_INITIALIZE_MINT = 0,
    TOKEN_INSTRUCTION_INITIALIZE_ACCOUNT = 1,
    TOKEN_INSTRUCTION_INITIALIZE_MULTISIG = 2,
    TOKEN_INSTRUCTION_TRANSFER = 3,
    TOKEN_INSTRUCTION_APPROVE = 4,
    TOKEN_INSTRUCTION_REVOKE = 5,
    TOKEN_INSTRUCTION_SET_AUTHORITY = 6,
    TOKEN_INSTRUCTION_MINT_TO = 7,
    TOKEN_INSTRUCTION_BURN = 8,
    TOKEN_INSTRUCTION_CLOSE_ACCOUNT = 9,
    TOKEN_INSTRUCTION_FREEZE_ACCOUNT = 10,
    TOKEN_INSTRUCTION_THAW_ACCOUNT = 11,
    TOKEN_INSTRUCTION_TRANSFER_CHECKED = 12,
    TOKEN_INSTRUCTION_APPROVE_CHECKED = 13,
    TOKEN_INSTRUCTION_MINT_TO_CHECKED = 14,
    TOKEN_INSTRUCTION_BURN_CHECKED = 15,
    TOKEN_INSTRUCTION_INITIALIZE_ACCOUNT2 = 16,
    TOKEN_INSTRUCTION_SYNC_NATIVE = 17,
    TOKEN_INSTRUCTION_INITIALIZE_ACCOUNT3 = 18,
    TOKEN_INSTRUCTION_INITIALIZE_MULTISIG2 = 19,
    TOKEN_INSTRUCTION_INITIALIZE_MINT2 = 20,
} TokenInstruction;

// === Structs ===

typedef struct {
    address mint;
    address owner;
    u64 balance;
    bool delegate_present;
    address delegate;
    TokenAccountState state;
    bool is_native_present;
    u64 is_native;
    u64 delegated_amount;
    bool close_authority_present;
    address close_authority;
} TokenAccount;

// === Functions ===

static void token_create_mint(
    const Context* ctx,
    address payer,
    address mint_address,
    address mint_authority,
    address freeze_authority,
    const slice* mint_seeds,
    u64 mint_seeds_len,
    u8 decimals
) {
    const u64 size = 82; // spl_token::state::Mint::LEN

    system_create_account(
        /* ctx */ ctx,
        /* destination */ mint_address,
        /* payer */ payer,
        /* owner */ TOKEN_PROGRAM_ID,
        /* size */ size,
        /* seeds */ mint_seeds, // Pass seeds directly
        /* seeds_len */ mint_seeds_len // Pass seeds_len directly
    );

    // Create instruction data using writer
    u8 data_buffer
        [1 + 1 + 32 + 1 +
         32]; // Max size: Type + Decimals + Authority + Option Flag + Authority
    writer w = writer_new(data_buffer, sizeof(data_buffer));

    // Write instruction type
    writer_write_u8(&w, TOKEN_INSTRUCTION_INITIALIZE_MINT2);

    // Write decimals
    writer_write_u8(&w, decimals);

    // Write mint authority
    writer_write_address(&w, &mint_authority);

    bool has_freeze_authority = !address_equal(&freeze_authority, &ADDRESS_ZERO);

    // Write freeze authority presence flag
    writer_write_u8(&w, has_freeze_authority ? 1 : 0);

    // If freeze authority is present, write it
    if (has_freeze_authority) {
        writer_write_address(&w, &freeze_authority);
    }

    SolAccountMeta init_metas[1] = {
        {.pubkey = &mint_address, .is_writable = true, .is_signer = false}
    };

    address token_program_id = TOKEN_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &token_program_id,
        .accounts = init_metas,
        .account_len = SOL_ARRAY_SIZE(init_metas),
        .data = data_buffer,
        .data_len = w.offset
    };

    context_invoke(ctx, &instruction, "Token Initialize Mint CPI failed");
}

static void token_create_account(
    const Context* ctx,
    address payer,
    address token_account,
    address mint_address,
    address owner,
    const slice* token_account_seeds,
    u64 token_account_seeds_len
) {
    const u64 size = 165; // spl_token::state::Account::LEN

    // Create token account with system
    system_create_account(
        /* ctx */ ctx,
        /* destination */ token_account,
        /* payer */ payer,
        /* owner */ TOKEN_PROGRAM_ID,
        /* size */ size,
        /* seeds */ token_account_seeds,
        /* seeds_len */ token_account_seeds_len
    );

    // Create instruction data using writer
    u8 data_buffer[1 + 32]; // Type + Owner
    writer w = writer_new(data_buffer, sizeof(data_buffer));

    // Write instruction type
    writer_write_u8(&w, TOKEN_INSTRUCTION_INITIALIZE_ACCOUNT3);

    // Write owner
    writer_write_address(&w, &owner);

    SolAccountMeta init_metas[2] = {
        {.pubkey = &token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &mint_address, .is_writable = false, .is_signer = false}
    };

    address token_program_id = TOKEN_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &token_program_id,
        .accounts = init_metas,
        .account_len = SOL_ARRAY_SIZE(init_metas),
        .data = data_buffer,
        .data_len = w.offset
    };

    context_invoke(ctx, &instruction, "Token Initialize Account CPI failed");
}

static void token_mint(
    const Context* ctx,
    address mint_address,
    address mint_authority,
    address destination,
    u64 amount
) {
    // Create instruction data using writer
    u8 data_buffer[1 + 8]; // Type + Amount
    writer w = writer_new(data_buffer, sizeof(data_buffer));

    // Write instruction type
    writer_write_u8(&w, TOKEN_INSTRUCTION_MINT_TO);

    // Write amount
    writer_write_u64(&w, amount);

    SolAccountMeta metas[3] = {
        {.pubkey = &mint_address, .is_writable = true, .is_signer = false},
        {.pubkey = &destination, .is_writable = true, .is_signer = false},
        {.pubkey = &mint_authority, .is_writable = false, .is_signer = true}
    };

    address token_program_id = TOKEN_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &token_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data_buffer,
        .data_len = w.offset
    };

    context_invoke(ctx, &instruction, "Token Mint CPI failed");
}

static void token_mint_signed(
    const Context* ctx,
    address mint_address,
    address mint_authority,
    address destination,
    u64 amount,
    const slice* mint_authority_seeds,
    u64 mint_authority_seeds_len
) {
    // Create instruction data using writer
    u8 data_buffer[1 + 8]; // Type + Amount
    writer w = writer_new(data_buffer, sizeof(data_buffer));

    // Write instruction type
    writer_write_u8(&w, TOKEN_INSTRUCTION_MINT_TO);

    // Write amount
    writer_write_u64(&w, amount);

    SolAccountMeta metas[3] = {
        {.pubkey = &mint_address, .is_writable = true, .is_signer = false},
        {.pubkey = &destination, .is_writable = true, .is_signer = false},
        {.pubkey = &mint_authority, .is_writable = false, .is_signer = true}
    };

    address token_program_id = TOKEN_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &token_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data_buffer,
        .data_len = w.offset
    };

    // Construct SolSignerSeeds for invoke_signed
    SolSignerSeeds signer_seeds = {
        .addr = mint_authority_seeds, .len = mint_authority_seeds_len
    };

    context_invoke_signed(
        ctx, &instruction, signer_seeds, "Token Mint Signed CPI failed"
    );
}

static void token_burn(
    const Context* ctx,
    address token_account,
    address mint_address,
    address owner,
    u64 amount
) {
    // Create instruction data using writer
    u8 data_buffer[1 + 8]; // Type + Amount
    writer w = writer_new(data_buffer, sizeof(data_buffer));

    // Write instruction type
    writer_write_u8(&w, TOKEN_INSTRUCTION_BURN);

    // Write amount
    writer_write_u64(&w, amount);

    SolAccountMeta metas[3] = {
        {.pubkey = &token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &mint_address, .is_writable = true, .is_signer = false},
        {.pubkey = &owner, .is_writable = false, .is_signer = true}
    };

    address token_program_id = TOKEN_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &token_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data_buffer,
        .data_len = w.offset
    };

    context_invoke(ctx, &instruction, "Token Burn CPI failed");
}

static void token_burn_signed(
    const Context* ctx,
    address token_account,
    address mint_address,
    address owner,
    u64 amount,
    const slice* owner_seeds,
    u64 owner_seeds_len
) {
    // Create instruction data using writer
    u8 data_buffer[1 + 8]; // Type + Amount
    writer w = writer_new(data_buffer, sizeof(data_buffer));

    // Write instruction type
    writer_write_u8(&w, TOKEN_INSTRUCTION_BURN);

    // Write amount
    writer_write_u64(&w, amount);

    SolAccountMeta metas[3] = {
        {.pubkey = &token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &mint_address, .is_writable = true, .is_signer = false},
        {.pubkey = &owner, .is_writable = false, .is_signer = true}
    };

    address token_program_id = TOKEN_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &token_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data_buffer,
        .data_len = w.offset
    };

    // Construct SolSignerSeeds for invoke_signed
    SolSignerSeeds signer_seeds = {.addr = owner_seeds, .len = owner_seeds_len};

    context_invoke_signed(
        ctx, &instruction, signer_seeds, "Token Burn Signed CPI failed"
    );
}

static void token_set_authority(
    const Context* ctx,
    address mint_or_token_account,
    TokenAuthority kind,
    address authority,
    address new_authority
) {
    // Create instruction data using writer
    u8 data_buffer[1 + 1 + 1 + 32]; // Type + Kind + Option Flag + Authority
    writer w = writer_new(data_buffer, sizeof(data_buffer));

    // Write instruction type
    writer_write_u8(&w, TOKEN_INSTRUCTION_SET_AUTHORITY);

    // Write authority type
    writer_write_u8(&w, (u8)kind);

    bool has_new_authority = !address_equal(&new_authority, &ADDRESS_ZERO);

    // Write new authority presence flag
    writer_write_u8(&w, has_new_authority ? 1 : 0);

    // If new authority is present, write it
    if (has_new_authority) {
        writer_write_address(&w, &new_authority);
    }

    SolAccountMeta metas[2] = {
        {.pubkey = &mint_or_token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &authority, .is_writable = false, .is_signer = true}
    };

    address token_program_id = TOKEN_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &token_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data_buffer,
        .data_len = w.offset
    };

    context_invoke(ctx, &instruction, "Token Set Authority CPI failed");
}

static void token_set_authority_signed(
    const Context* ctx,
    address mint_or_token_account,
    TokenAuthority kind,
    address authority,
    address new_authority,
    const slice* authority_seeds,
    u64 authority_seeds_len
) {
    // Create instruction data using writer
    u8 data_buffer[1 + 1 + 1 + 32]; // Type + Kind + Option Flag + Authority
    writer w = writer_new(data_buffer, sizeof(data_buffer));

    // Write instruction type
    writer_write_u8(&w, TOKEN_INSTRUCTION_SET_AUTHORITY);

    // Write authority type
    writer_write_u8(&w, (u8)kind);

    bool has_new_authority = !address_equal(&new_authority, &ADDRESS_ZERO);

    // Write new authority presence flag
    writer_write_u8(&w, has_new_authority ? 1 : 0);

    // If new authority is present, write it
    if (has_new_authority) {
        writer_write_address(&w, &new_authority);
    }

    SolAccountMeta metas[2] = {
        {.pubkey = &mint_or_token_account, .is_writable = true, .is_signer = false},
        {.pubkey = &authority, .is_writable = false, .is_signer = true}
    };

    address token_program_id = TOKEN_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &token_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data_buffer,
        .data_len = w.offset
    };

    // Construct SolSignerSeeds for invoke_signed
    SolSignerSeeds signer_seeds = {.addr = authority_seeds, .len = authority_seeds_len};

    context_invoke_signed(
        ctx, &instruction, signer_seeds, "Token Set Authority Signed CPI failed"
    );
}

static void token_transfer(
    const Context* ctx, address source, address destination, address owner, u64 amount
) {
    // Create instruction data using writer
    u8 data_buffer[1 + 8]; // Type + Amount
    writer w = writer_new(data_buffer, sizeof(data_buffer));

    // Write instruction type
    writer_write_u8(&w, TOKEN_INSTRUCTION_TRANSFER);

    // Write amount
    writer_write_u64(&w, amount);

    SolAccountMeta metas[3] = {
        {.pubkey = &source, .is_writable = true, .is_signer = false},
        {.pubkey = &destination, .is_writable = true, .is_signer = false},
        {.pubkey = &owner, .is_writable = false, .is_signer = true}
    };

    address token_program_id = TOKEN_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &token_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data_buffer,
        .data_len = w.offset
    };

    context_invoke(ctx, &instruction, "Token Transfer CPI failed");
}

static void token_transfer_signed(
    const Context* ctx,
    address source,
    address destination,
    address owner,
    u64 amount,
    const slice* owner_seeds,
    u64 owner_seeds_len
) {
    // Create instruction data using writer
    u8 data_buffer[1 + 8]; // Type + Amount
    writer w = writer_new(data_buffer, sizeof(data_buffer));

    // Write instruction type
    writer_write_u8(&w, TOKEN_INSTRUCTION_TRANSFER);

    // Write amount
    writer_write_u64(&w, amount);

    SolAccountMeta metas[3] = {
        {.pubkey = &source, .is_writable = true, .is_signer = false},
        {.pubkey = &destination, .is_writable = true, .is_signer = false},
        {.pubkey = &owner, .is_writable = false, .is_signer = true}
    };

    address token_program_id = TOKEN_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &token_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data_buffer,
        .data_len = w.offset
    };

    // Construct SolSignerSeeds for invoke_signed
    SolSignerSeeds signer_seeds = {.addr = owner_seeds, .len = owner_seeds_len};

    context_invoke_signed(
        ctx, &instruction, signer_seeds, "Token Transfer Signed CPI failed"
    );
}

/// Does the given token account exist, and is it valid?
static bool token_exists(const SolAccountInfo* info) {
    return info != NULL // valid ptr
        && info->data_len == 165 // right length
        && address_equal(info->owner, &TOKEN_PROGRAM_ID) // right owner
        && info->data[108] == 1; // state == Initialized
}

/// A lighter version of `token_unpack` that just gets the token balance.
/// Allows for nonexistent accounts by returning 0.
static u64 token_get_balance(const SolAccountInfo* info) {
    require(info != NULL, "Token info is NULL");
    if (info->data_len == 0) {
        // nonexistent
        return 0;
    }
    // If the account exists, it must be correct.
    require(
        address_equal(info->owner, &TOKEN_PROGRAM_ID),
        "Account not owned by token program"
    );
    require(info->data_len == 165, "Incorrect token account data length");
    // TokenAccount.balance is at byte offset 64
    return *(u64*)&info->data[64];
}

/// Gets the total supply of the provided token mint.
/// Reverts if an invalid account is provided.
static u64 token_mint_get_supply(const SolAccountInfo* mint_info) {
    require(mint_info != NULL, "Mint info is NULL");
    require(
        address_equal(mint_info->owner, &TOKEN_PROGRAM_ID),
        "Account not owned by token program"
    );
    require(mint_info->data_len == 82, "Incorrect mint data length");
    return *(u64*)&mint_info->data[36];
}

/// Unpacks a token account.
static TokenAccount token_unpack(const SolAccountInfo* info) {
    require(info != NULL, "Token info is NULL");
    require(
        address_equal(info->owner, &TOKEN_PROGRAM_ID),
        "Account not owned by token program"
    );
    require(info->data_len == 165, "Incorrect token account data length");

    TokenAccount account; // Create a local TokenAccount to return

    // Create a reader from the account data
    reader r = reader_new(info->data, info->data_len);

    // Read mint address
    account.mint = reader_read_address(&r);

    // Read owner address
    account.owner = reader_read_address(&r);

    // Read balance
    account.balance = reader_read_u64(&r);

    // Read delegate option
    u32 delegate_tag = reader_read_u32(&r);

    account.delegate_present = (delegate_tag != 0);
    if (account.delegate_present) {
        account.delegate = reader_read_address(&r);
    } else {
        account.delegate = ADDRESS_ZERO; // Initialize to zero if not present
    }

    // Read state
    u8 state = reader_read_u8(&r);
    account.state = (TokenAccountState)state;

    // Read is_native option
    u32 is_native_tag = reader_read_u32(&r);

    account.is_native_present = (is_native_tag != 0);
    if (account.is_native_present) {
        account.is_native = reader_read_u64(&r);
    } else {
        account.is_native = 0; // Initialize to zero if not present
    }

    // Read delegated amount
    account.delegated_amount = reader_read_u64(&r);

    // Read close authority option
    u32 close_authority_tag = reader_read_u32(&r);

    account.close_authority_present = (close_authority_tag != 0);
    if (account.close_authority_present) {
        account.close_authority = reader_read_address(&r);
    } else {
        account.close_authority = ADDRESS_ZERO; // Initialize to zero if not present
    }

    return account;
}

static void token_freeze_signed(
    const Context* ctx,
    address account,
    address mint_address,
    address freeze_authority,
    const slice* freeze_authority_seeds,
    u64 freeze_authority_seeds_len
) {
    // Create instruction data
    u8 data_buffer[1];
    writer w = writer_new(data_buffer, sizeof(data_buffer));
    writer_write_u8(&w, TOKEN_INSTRUCTION_FREEZE_ACCOUNT);

    SolAccountMeta metas[3] = {
        {.pubkey = &account, .is_writable = true, .is_signer = false},
        {.pubkey = &mint_address, .is_writable = false, .is_signer = false},
        {.pubkey = &freeze_authority, .is_writable = false, .is_signer = true}
    };

    address token_program_id = TOKEN_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &token_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data_buffer,
        .data_len = w.offset
    };

    // Construct SolSignerSeeds for invoke_signed
    SolSignerSeeds signer_seeds = {
        .addr = freeze_authority_seeds, .len = freeze_authority_seeds_len
    };

    context_invoke_signed(
        ctx, &instruction, signer_seeds, "Token Freeze Signed CPI failed"
    );
}

static void token_close_account(
    const Context* ctx, address account, address destination, address owner
) {
    // Create instruction data - only contains the instruction type
    u8 data[1] = {TOKEN_INSTRUCTION_CLOSE_ACCOUNT};

    SolAccountMeta metas[3] = {
        {.pubkey = &account, .is_writable = true, .is_signer = false},
        {.pubkey = &destination, .is_writable = true, .is_signer = false},
        {.pubkey = &owner, .is_writable = false, .is_signer = true}
    };

    address token_program_id = TOKEN_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &token_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = data,
        .data_len = sizeof(data),
    };

    context_invoke(ctx, &instruction, "Token Close Account CPI failed");
}

#endif // IVY_TOKEN_H
