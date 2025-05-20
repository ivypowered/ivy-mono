#ifndef IVY_METADATA_H
#define IVY_METADATA_H

#include "context.h"
#include "rw.h"
#include "types.h"
#include <solana_sdk.h>

// === Constants ===
static const u8 CREATE_METADATA_ACCOUNT_V3 = 33;
static const u8 UPDATE_METADATA_ACCOUNT_V2 = 15;
static const u64 MIN_METADATA_ACCOUNT_SIZE = 1 + 32 + 32;

// must use define here, otherwise arr[MAX_...]
// gets interpreted as dynamic stack allocation
#define MAX_METADATA_INSTRUCTION_SIZE 512

// === Structs ===

typedef struct {
    slice name;
    slice symbol;
    slice uri;
} MetadataDataV2;

// === Functions ===

static address metadata_derive_address(address mint) {
    const slice metadata_seed = slice_from_str("metadata");
    const slice seeds[3] = {
        metadata_seed,
        slice_from_address(&METAPLEX_PROGRAM_ID),
        slice_from_address(&mint)
    };

    return find_program_address(
               seeds,
               SOL_ARRAY_SIZE(seeds),
               METAPLEX_PROGRAM_ID,
               "Can't derive metadata address"
    )
        .key;
}

static void metadata_create(
    const Context* ctx,
    address metadata,
    address mint,
    address mint_authority,
    address update_authority,
    address user,
    const MetadataDataV2* data
) {
    require(data != NULL, "Metadata data cannot be NULL for creation.");
    require(data->name.addr != NULL, "Metadata name cannot be NULL");
    require(data->symbol.addr != NULL, "Metadata symbol cannot be NULL");
    require(data->uri.addr != NULL, "Metadata uri cannot be NULL");

    bool is_mutable = !address_equal(&update_authority, &ADDRESS_ZERO);
    u8 instruction_data[MAX_METADATA_INSTRUCTION_SIZE];
    writer w = writer_new(instruction_data, MAX_METADATA_INSTRUCTION_SIZE);

    writer_write_u8(&w, CREATE_METADATA_ACCOUNT_V3);

    // Write name length (u32) and content
    u32 name_len = data->name.len;
    writer_write_u32(&w, name_len);
    writer_write_slice(&w, data->name);

    // Write symbol length (u32) and content
    u32 symbol_len = data->symbol.len;
    writer_write_u32(&w, symbol_len);
    writer_write_slice(&w, data->symbol);

    // Write URI length (u32) and content
    u32 uri_len = data->uri.len;
    writer_write_u32(&w, uri_len);
    writer_write_slice(&w, data->uri);

    // Write seller fee basis points (u16)
    writer_write_u16(&w, 0);

    // Write Option<Creators> - None (u8)
    writer_write_u8(&w, 0);

    // Write Option<Collection> - None (u8)
    writer_write_u8(&w, 0);

    // Write Option<Uses> - None (u8)
    writer_write_u8(&w, 0);
    // End of inlined serialize_data_v2

    // Write is_mutable flag
    writer_write_u8(&w, is_mutable ? 1 : 0);

    // Write CollectionDetails: None
    writer_write_u8(&w, 0);

    address system_program_id = SYSTEM_PROGRAM_ID;
    SolAccountMeta metas[6] = {
        {.pubkey = &metadata, .is_writable = true, .is_signer = false},
        {.pubkey = &mint, .is_writable = false, .is_signer = false},
        {.pubkey = &mint_authority, .is_writable = false, .is_signer = true},
        {.pubkey = &user, .is_writable = true, .is_signer = true},
        {.pubkey = &update_authority, .is_writable = false, .is_signer = false},
        {.pubkey = &system_program_id, .is_writable = false, .is_signer = false}
    };

    address metaplex_program_id = METAPLEX_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &metaplex_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = instruction_data,
        .data_len = w.offset
    };

    context_invoke(ctx, &instruction, "Metadata Create CPI failed");
}

static void metadata_update_signed(
    const Context* ctx,
    address metadata,
    address update_authority,
    address new_update_authority,
    const MetadataDataV2* data,
    const slice* update_authority_seeds,
    u64 update_authority_seeds_len
) {
    require(data != NULL, "Missing data argument for metadata update.");
    require(update_authority_seeds != NULL, "Missing seeds for metadata update.");
    require(data->name.addr != NULL, "Metadata name cannot be NULL");
    require(data->symbol.addr != NULL, "Metadata symbol cannot be NULL");
    require(data->uri.addr != NULL, "Metadata uri cannot be NULL");

    bool new_is_mutable = !address_equal(&new_update_authority, &ADDRESS_ZERO);
    u8 instruction_data[MAX_METADATA_INSTRUCTION_SIZE];
    writer w = writer_new(instruction_data, MAX_METADATA_INSTRUCTION_SIZE);

    writer_write_u8(&w, UPDATE_METADATA_ACCOUNT_V2);

    // Write Data option (Some)
    writer_write_u8(&w, 1);

    // Inline serialize_data_v2
    // Write name length (u32) and content
    u32 name_len = data->name.len;
    writer_write_u32(&w, name_len);
    writer_write_slice(&w, data->name);

    // Write symbol length (u32) and content
    u32 symbol_len = data->symbol.len;
    writer_write_u32(&w, symbol_len);
    writer_write_slice(&w, data->symbol);

    // Write URI length (u32) and content
    u32 uri_len = data->uri.len;
    writer_write_u32(&w, uri_len);
    writer_write_slice(&w, data->uri);

    // Write seller fee basis points (u16)
    writer_write_u16(&w, 0);

    // Write Option<Creators> - None (u8)
    writer_write_u8(&w, 0);

    // Write Option<Collection> - None (u8)
    writer_write_u8(&w, 0);

    // Write Option<Uses> - None (u8)
    writer_write_u8(&w, 0);
    // End of inlined serialize_data_v2

    // Write Option<Pubkey> New Update Authority flag (Some)
    writer_write_u8(&w, 1);

    // Write new_update_authority
    writer_write_address(&w, &new_update_authority);

    // Write Option<bool> Primary Sale Happened (None)
    writer_write_u8(&w, 0);

    // Write Option<bool> Is Mutable flag (Some)
    writer_write_u8(&w, 1);

    // Write is_mutable value
    writer_write_u8(&w, new_is_mutable ? 1 : 0);

    SolAccountMeta metas[2] = {
        {.pubkey = &metadata, .is_writable = true, .is_signer = false},
        {.pubkey = &update_authority, .is_writable = false, .is_signer = true}
    };

    address metaplex_program_id = METAPLEX_PROGRAM_ID;
    const SolInstruction instruction = {
        .program_id = &metaplex_program_id,
        .accounts = metas,
        .account_len = SOL_ARRAY_SIZE(metas),
        .data = instruction_data,
        .data_len = w.offset
    };

    const SolSignerSeeds signer_seeds = {
        .addr = update_authority_seeds, .len = update_authority_seeds_len
    };

    context_invoke_signed(
        ctx, &instruction, signer_seeds, "Metadata Update CPI failed"
    );
}

static void metadata_unpack(
    const SolAccountInfo* account_info, MetadataDataV2* data_out
) {
    require(account_info != NULL, "Metadata account_info cannot be NULL");
    require(account_info->data != NULL, "Metadata account_info data cannot be NULL");
    require(data_out != NULL, "Metadata data_out cannot be NULL");
    require(
        address_equal(account_info->owner, &METAPLEX_PROGRAM_ID),
        "Account not owned by metaplex program"
    );
    require(
        account_info->data_len >= MIN_METADATA_ACCOUNT_SIZE,
        "Incorrect metadata account size"
    );

    reader r = reader_new(account_info->data, account_info->data_len);

    // Check metadata key (MetadataV1 = 4)
    u8 key = reader_read_u8(&r);
    require(key == 4, "Invalid metadata key");

    // Skip update authority
    reader_skip(&r, 32);

    // Skip mint address
    reader_skip(&r, 32);

    // Read name length
    u32 name_length = reader_read_u32(&r);

    // Read name
    data_out->name = reader_read_slice(&r, name_length);

    // Read symbol length
    u32 symbol_length = reader_read_u32(&r);

    // Read symbol
    data_out->symbol = reader_read_slice(&r, symbol_length);

    // Read URI length
    u32 uri_length = reader_read_u32(&r);

    // Read uri
    data_out->uri = reader_read_slice(&r, uri_length);
}

#endif // IVY_METADATA_H
