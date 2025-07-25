#ifndef IVY_LIB_IX_H
#define IVY_LIB_IX_H

#include "rw.h" // For reader functions
#include "types.h" // For address, u16, u64, slice, require, IX_PROGRAM_ID, etc.
#include <solana_sdk.h> // For SolAccountInfo

// === Structs ===

/// Represents a partially deserialized instruction from the Instructions Sysvar.
/// Contains the essential identifiers and the raw instruction data payload.
typedef struct {
    /// The address of the program this instruction targets.
    address program_id;
    /// The number of account metas associated with this instruction.
    u16 num_accounts;
    /// A slice pointing to the instruction-specific data payload.
    /// This memory is BORROWED from the original sysvar account data.
    slice data;
} SerializedInstruction;

// === Functions ===

/// Returns the total number of instructions in the current transaction.
/// Reads the count from the Instructions Sysvar account data using the reader interface.
///
/// @param info AccountInfo for the Instructions Sysvar (must have key IX_PROGRAM_ID).
/// @return The number of instructions (u16).
static u16 ix_len(const SolAccountInfo* info) {
    require(info != NULL, "Instructions Sysvar info cannot be NULL");
    require(
        address_equal(info->key, &IX_PROGRAM_ID),
        "Account key is not the Instructions Sysvar ID"
    );
    // Create reader (will check length >= 2 internally when reading)
    reader r = reader_new(info->data, info->data_len);

    // Read the number of instructions (u16 at the beginning).
    u16 num_instructions = reader_read_u16(&r);

    return num_instructions;
}

/// Retrieves a specific instruction by its index from the Instructions Sysvar.
/// Deserializes only the program_id, account count, and data slice.
/// Uses only functions from the reader interface (no direct memory access).
///
/// @param info AccountInfo for the Instructions Sysvar (must have key IX_PROGRAM_ID).
/// @param index The 0-based index of the instruction to retrieve.
/// @return A SerializedInstruction struct containing details of the requested instruction.
static SerializedInstruction ix_get(const SolAccountInfo* info, u16 index) {
    require(info != NULL, "Instructions Sysvar info cannot be NULL");
    require(
        address_equal(info->key, &IX_PROGRAM_ID),
        "Account key is not the Instructions Sysvar ID"
    );

    // Create reader for the whole sysvar data buffer.
    reader r = reader_new(info->data, info->data_len);

    // --- Read total count and instruction offset using reader functions ---

    // Read the total number of instructions
    u16 num_instructions = reader_read_u16(&r);

    // Check if the requested index is valid.
    require(index < num_instructions, "Instruction index out of bounds");

    // Skip `index` entries in the u16 offset table, which starts right after
    // the instruction index
    reader_skip(&r, (u64)index * 2);

    // Read the offset (u16)
    u16 instruction_data_offset = reader_read_u16(&r);

    // Set the reader's internal offset to the start of the target instruction's data.
    reader_seek(&r, (u64)instruction_data_offset);

    // --- Deserialize the instruction fields using the positioned reader ---

    // 1. Read number of accounts (u16).
    // reader_read_* functions perform bounds checks from the current r.offset
    u16 num_accounts = reader_read_u16(&r);

    // 2. Skip over the account metas. Each meta consists of:
    //    - u8 flags (is_signer, is_writable)
    //    - 32 bytes pubkey
    //    Total = 33 bytes per account meta.
    u64 account_metas_size = (u64)num_accounts * 33;
    reader_skip(&r, account_metas_size);

    // 3. Read the program_id (address/pubkey).
    address program_id = reader_read_address(&r);

    // 4. Read the length of the instruction-specific data (u16).
    u16 data_len = reader_read_u16(&r);

    // 5. Read the instruction-specific data as a BORROWED slice
    //    (IX data can't be modified).
    slice data_slice = reader_read_slice_borrowed(&r, data_len);

    // Construct and return the result structure.
    SerializedInstruction result;
    result.program_id = program_id;
    result.num_accounts = num_accounts;
    result.data = data_slice; // data_slice now points into info->data

    return result;
}

#endif // IVY_IX_H
