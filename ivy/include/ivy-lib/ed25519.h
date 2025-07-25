#ifndef IVY_LIB_ED25519_H
#define IVY_LIB_ED25519_H

#include "ix.h" // For SerializedInstruction, ix_len, ix_get
#include "rw.h" // For reader, reader_* functions
#include "types.h" // For address, slice, bytes64, require, ED25519_PROGRAM_ID, etc.

/// Verifies an Ed25519 signature by finding a corresponding instruction
/// targeting the Ed25519 program in the transaction's instruction sysvar,
/// failing if we can't find it.
///
/// @param ix_info AccountInfo for the Instructions Sysvar (must have key IX_PROGRAM_ID).
/// @param msg The message slice that was supposedly signed.
/// @param signature The 64-byte Ed25519 signature to verify.
/// @param public_key The 32-byte public key corresponding to the signer.
static void ed25519_verify(
    const SolAccountInfo* ix_info, slice msg, bytes64 signature, address public_key
) {
    const u16 num_instructions = ix_len(ix_info);
    const slice expected_sig_slice = slice_from_bytes64(&signature);
    const slice expected_pk_slice = slice_from_address(&public_key);

    // Expected offsets and values for a well-formed Ed25519 instruction
    const u16 base_offset = 16; // 1(count) + 1(pad) + 7*2(u16s)
    const u16 exp_public_key_offset = base_offset;
    const u16 exp_signature_offset = exp_public_key_offset + 32;
    const u16 exp_message_data_offset = exp_signature_offset + 64;
    const u8 exp_num_signatures = 1;
    const u16 exp_message_data_size = (u16)msg.len;

    for (u16 i = 0; i < num_instructions; ++i) {
        SerializedInstruction current_ix = ix_get(ix_info, i);

        // Skip non-Ed25519 program instructions
        if (!address_equal(&current_ix.program_id, &ED25519_PROGRAM_ID)) {
            continue;
        }

        reader r = reader_new(current_ix.data.addr, current_ix.data.len);

        // 1. Read header fields
        u8 num_signatures = reader_read_u8(&r);
        reader_skip(&r, 1); // padding
        u16 signature_offset = reader_read_u16(&r);
        u16 signature_instruction_index = reader_read_u16(&r);
        u16 public_key_offset = reader_read_u16(&r);
        u16 public_key_instruction_index = reader_read_u16(&r);
        u16 message_data_offset = reader_read_u16(&r);
        u16 message_data_size = reader_read_u16(&r);
        u16 message_instruction_index = reader_read_u16(&r);

        // 2. Check if header values match expected format
        require(
            num_signatures == exp_num_signatures &&
                signature_offset == exp_signature_offset &&
                signature_instruction_index == UINT16_MAX &&
                public_key_offset == exp_public_key_offset &&
                public_key_instruction_index == UINT16_MAX &&
                message_data_offset == exp_message_data_offset &&
                message_data_size == exp_message_data_size &&
                message_instruction_index == UINT16_MAX,
            "ed25519_verify: instruction format is incorrect"
        );

        // 3. Check if the reader has enough data remaining
        u64 expected_remaining_data =
            expected_pk_slice.len + expected_sig_slice.len + msg.len;
        require(
            reader_remaining(&r) >= expected_remaining_data,
            "ed25519_verify: Insufficient data in the reader"
        );

        // 4. Read and verify embedded data parts
        slice embedded_pk_slice = reader_read_slice_borrowed(&r, expected_pk_slice.len);
        slice embedded_sig_slice =
            reader_read_slice_borrowed(&r, expected_sig_slice.len);
        slice embedded_msg_slice = reader_read_slice_borrowed(&r, msg.len);

        // 5. Compare with expected values
        require(
            slice_equal(&embedded_pk_slice, &expected_pk_slice),
            "ed25519_verify(): Public key mismatch"
        );
        require(
            slice_equal(&embedded_sig_slice, &expected_sig_slice),
            "ed25519_verify(): Signature mismatch"
        );
        require(
            slice_equal(&embedded_msg_slice, &msg), "ed25519_verify(): Message mismatch"
        );

        // We're good! Everything matches.
        return;
    }

    require(false, "ed25519_verify(): Can't find ed25519 instruction");
}

#endif // IVY_ED25519_H
