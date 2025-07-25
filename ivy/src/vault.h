#ifndef IVY_VAULT_H
#define IVY_VAULT_H

#include "world.h"
#include <ivy-lib/ata.h>
#include <ivy-lib/context.h>
#include <ivy-lib/ed25519.h>
#include <ivy-lib/event.h>
#include <ivy-lib/system.h>
#include <ivy-lib/token.h>
#include <ivy-lib/types.h>

static const char* const VAULT_PREFIX = "vault";
static const char* const VAULT_WALLET_PREFIX = "vault_wallet";
static const char* const VAULT_DEPOSIT_PREFIX = "vault_deposit";
static const char* const VAULT_WITHDRAW_PREFIX = "vault_withdraw";

// #idl event declaration
typedef struct {
    u64 discriminator;
    address vault;
    bytes32 id;
} VaultDepositEvent;

// #idl event discriminator VaultDepositEvent
static const u64 VAULT_DEPOSIT_EVENT_DISCRIMINATOR = UINT64_C(0xd5661c0b15188928);

// #idl event declaration
typedef struct {
    u64 discriminator;
    address vault;
    bytes32 id;
} VaultWithdrawEvent;

// #idl event discriminator VaultWithdrawEvent
static const u64 VAULT_WITHDRAW_EVENT_DISCRIMINATOR = UINT64_C(0xa4c1f6dae1bbb260);

// #idl struct declaration
typedef struct {
    u64 discriminator;
    /// The owner of the vault
    address owner;
    /// The withdraw authority
    address withdraw_authority;
    /// The IVY wallet for the vault
    address wallet;
} Vault;

// #idl struct discriminator Vault
static const u64 VAULT_DISCRIMINATOR = UINT64_C(0x8b7c9e6b8dd23c74);

// #idl instruction accounts vault_create
typedef struct {
    // #idl writable
    SolAccountInfo vault;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo wallet;
    // #idl readonly
    SolAccountInfo ivy_mint;
    // #idl readonly
    SolAccountInfo system_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo world;
} VaultCreateAccounts;

// #idl instruction data vault_create
typedef struct {
    bytes32 seed;
} VaultCreateData;

// #idl instruction discriminator vault_create
static const u64 VAULT_CREATE_DISCRIMINATOR = UINT64_C(0x505dbc1044699752);

// #idl instruction declaration
static void vault_create(
    const Context* ctx, const VaultCreateAccounts* accounts, const VaultCreateData* data
) {
    // Verify that our seeds match the vault address
    slice vault_seeds[2] = {
        slice_from_str(VAULT_PREFIX), slice_from_bytes32(&data->seed)
    };
    address vault_address = create_program_address(
        /* seeds */ vault_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(vault_seeds),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't create vault address"
    );
    require(
        address_equal(accounts->vault.key, &vault_address), "Incorrect vault address"
    );

    address user = *accounts->user.key;

    // Create the vault account via CPI
    system_create_account(
        /* ctx */ ctx,
        /* destination */ vault_address,
        /* payer */ user,
        /* owner */ *ctx->program_id,
        /* size */ sizeof(Vault),
        /* seeds */ vault_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(vault_seeds)
    );

    // Verify that our seeds match the wallet address
    slice wallet_seeds[2] = {
        slice_from_str(VAULT_WALLET_PREFIX), slice_from_address(&vault_address)
    };
    address wallet_address = create_program_address(
        /* seeds */ wallet_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(wallet_seeds),
        /* program_id */ *ctx->program_id,
        /* msg */ "Can't create wallet address"
    );
    require(
        address_equal(accounts->wallet.key, &wallet_address), "Incorrect wallet address"
    );

    // Create the wallet account via CPI, its own authority
    address wallet = *accounts->wallet.key;
    const World* w = world_load(ctx, &accounts->world);
    token_create_account(
        /* ctx */ ctx,
        /* payer */ user,
        /* token_account */ wallet,
        /* mint_address */ w->ivy_mint,
        /* owner */ wallet,
        /* token_account_seeds */ wallet_seeds,
        /* token_account_seeds_len */ SOL_ARRAY_SIZE(wallet_seeds)
    );

    Vault* s = (Vault*)accounts->vault.data;
    s->discriminator = VAULT_DISCRIMINATOR;
    s->owner = user;
    s->withdraw_authority = ADDRESS_ZERO;
    s->wallet = wallet;
}

static Vault* vault_load(const Context* ctx, const SolAccountInfo* vault) {
    // See SECURITY.md for more details
    // 1. Ensure account ownership
    require(
        address_equal(ctx->program_id, vault->owner), "Incorrect Vault account owner"
    );
    // 2. Ensure data is of necessary length
    require(vault->data_len >= sizeof(Vault), "Provided Vault account data too small");
    Vault* s = (Vault*)vault->data;
    // 3. Verify discriminator
    require(
        s->discriminator == VAULT_DISCRIMINATOR,
        "Provided Vault discriminator incorrect"
    );
    return s;
}

/* ------------------------------ */

// #idl instruction accounts vault_deposit
typedef struct {
    // #idl readonly
    SolAccountInfo vault;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo source;
    // #idl writable
    SolAccountInfo wallet;
    // #idl writable
    SolAccountInfo deposit;
    // #idl readonly
    SolAccountInfo ivy_mint;
    // #idl readonly
    SolAccountInfo world;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo system_program;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
} VaultDepositAccounts;

// #idl instruction data vault_deposit
typedef struct {
    bytes32 id; // Deposit ID with amount in last 8 bytes
} VaultDepositData;

// #idl instruction discriminator vault_deposit
static const u64 VAULT_DEPOSIT_DISCRIMINATOR = UINT64_C(0xcebb4f7666fa5625);

/// Called by the user to deposit IVY tokens to the vault.
/// The deposit ID should contain 24 random bytes + 8 bytes for the amount.
// #idl instruction declaration
static void vault_deposit(
    const Context* ctx,
    const VaultDepositAccounts* accounts,
    const VaultDepositData* data
) {
    // Load vault
    const Vault* vault = vault_load(ctx, &accounts->vault);
    // Load world
    const World* world = world_load(ctx, &accounts->world);

    // Derive on-chain deposit account for idempotency
    slice deposit_seeds_pre[3] = {
        slice_from_str(VAULT_DEPOSIT_PREFIX),
        slice_from_address(accounts->vault.key),
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

    // Ensure we haven't done this deposit before
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

    // Transfer tokens from user to vault wallet
    token_transfer(
        /* ctx */ ctx,
        /* source */ *accounts->source.key,
        /* destination */ vault->wallet,
        /* owner */ *accounts->user.key,
        /* amount */ amount
    );

    // Derive full deposit seeds including nonce
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

    // Emit deposit event
    VaultDepositEvent deposit_event = {
        .discriminator = VAULT_DEPOSIT_EVENT_DISCRIMINATOR,
        .vault = *accounts->vault.key,
        .id = data->id,
    };
    event_emit(
        /* ctx */ ctx,
        /* evt_data */ slice_new((const u8*)&deposit_event, sizeof(deposit_event)),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

/* ------------------------------ */

// #idl instruction accounts vault_withdraw
typedef struct {
    // #idl readonly
    SolAccountInfo vault;
    // #idl writable
    SolAccountInfo wallet;
    // #idl writable
    SolAccountInfo destination;
    // #idl signer
    SolAccountInfo user;
    // #idl writable
    SolAccountInfo withdraw;
    // #idl readonly
    SolAccountInfo ivy_mint;
    // #idl readonly
    SolAccountInfo world;
    // #idl readonly
    SolAccountInfo system_program;
    // #idl readonly
    SolAccountInfo token_program;
    // #idl readonly
    SolAccountInfo ata_program;
    // #idl readonly
    SolAccountInfo ix_sysvar;
    // #idl readonly
    SolAccountInfo event_authority;
    // #idl readonly
    SolAccountInfo this_program;
} VaultWithdrawAccounts;

// #idl instruction data vault_withdraw
typedef struct {
    bytes32 id;
    bytes64 signature;
} VaultWithdrawData;

// #idl instruction discriminator vault_withdraw
static const u64 VAULT_WITHDRAW_DISCRIMINATOR = UINT64_C(0xc4aa068e90b911a6);

/// Called by the user to claim a withdraw of IVY tokens from the vault.
// #idl instruction declaration
static void vault_withdraw(
    const Context* ctx,
    const VaultWithdrawAccounts* accounts,
    const VaultWithdrawData* data
) {
    // Load vault
    const Vault* vault = vault_load(ctx, &accounts->vault);

    // Load world
    const World* world = world_load(ctx, &accounts->world);

    // Verify user claiming the withdraw has signed this TX
    require(accounts->user.is_signer, "User must sign vault_withdraw");

    // Verify provided signature
    u8 message[96];
    writer message_w = writer_new(message, sizeof(message));
    writer_write_address(&message_w, accounts->vault.key);
    writer_write_address(&message_w, accounts->user.key);
    writer_write_bytes32(&message_w, &data->id);
    ed25519_verify(
        /* ix_info */ &accounts->ix_sysvar,
        /* msg */ slice_new(message, sizeof(message)),
        /* signature */ data->signature,
        /* public_key */ vault->withdraw_authority
    );

    // Derive on-chain withdraw account
    slice withdraw_seeds_pre[3] = {
        slice_from_str(VAULT_WITHDRAW_PREFIX),
        slice_from_address(accounts->vault.key),
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

    // Get the seeds for the wallet PDA
    slice wallet_seeds[2] = {
        slice_from_str(VAULT_WALLET_PREFIX), slice_from_address(accounts->vault.key)
    };

    if (!token_exists(&accounts->destination)) {
        // Create user's destination ATA if needed
        ata_create(
            /* ctx */ ctx,
            /* payer_address */ *accounts->user.key,
            /* associated_token_address */ *accounts->destination.key,
            /* owner_address */ *accounts->user.key,
            /* mint_address */ world->ivy_mint
        );
    }

    // Transfer tokens from vault wallet to user destination
    token_transfer_signed(
        /* ctx */ ctx,
        /* source */ vault->wallet,
        /* destination */ *accounts->destination.key,
        /* owner */ vault->wallet,
        /* amount */ amount,
        /* owner_seeds */ wallet_seeds,
        /* owner_seeds_len */ SOL_ARRAY_SIZE(wallet_seeds)
    );

    // Derive full withdraw seeds including nonce
    slice withdraw_seeds[4] = {
        withdraw_seeds_pre[0],
        withdraw_seeds_pre[1],
        withdraw_seeds_pre[2],
        slice_new(&withdraw_pda.nonce, 1)
    };

    // Create withdraw account on-chain to prevent double withdraw
    system_create_account(
        /* ctx */ ctx,
        /* destination */ withdraw_pda.key,
        /* payer */ *accounts->user.key,
        /* owner */ *ctx->program_id,
        /* size */ 0,
        /* seeds */ withdraw_seeds,
        /* seeds_len */ SOL_ARRAY_SIZE(withdraw_seeds)
    );

    // Emit withdraw event
    VaultWithdrawEvent withdraw_event = {
        .discriminator = VAULT_WITHDRAW_EVENT_DISCRIMINATOR,
        .vault = *accounts->vault.key,
        .id = data->id,
    };
    event_emit(
        /* ctx */ ctx,
        /* evt_data */ slice_new((const u8*)&withdraw_event, sizeof(withdraw_event)),
        /* global_address */ *accounts->world.key,
        /* event_authority */ world->event_authority,
        /* event_authority_nonce */ world->event_authority_nonce
    );
}

/* ------------------------------ */

// #idl instruction accounts vault_edit
typedef struct {
    // #idl writable
    SolAccountInfo vault;
    // #idl signer
    SolAccountInfo owner;
} VaultEditAccounts;

// #idl instruction data vault_edit
typedef struct {
    address new_owner;
    address new_withdraw_authority;
} VaultEditData;

// #idl instruction discriminator vault_edit
static const u64 VAULT_EDIT_DISCRIMINATOR = UINT64_C(0x55dd0da174057ad1);

// #idl instruction declaration
static void vault_edit(
    const Context* ctx, const VaultEditAccounts* accounts, const VaultEditData* data
) {
    Vault* vault = vault_load(ctx, &accounts->vault);

    // Verify authorization
    require(
        address_equal(accounts->owner.key, &vault->owner),
        "Only the owner can edit vault"
    );
    require(accounts->owner.is_signer, "Owner must sign vault_edit");

    // Update fields
    vault->owner = data->new_owner;
    vault->withdraw_authority = data->new_withdraw_authority;
}

#endif
