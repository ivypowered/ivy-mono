#ifndef IVY_TYPES_H
#define IVY_TYPES_H

#include "noinline.h"
#include <solana_sdk.h>

#define UINT64_C(x) x##ULL

#ifdef __SIZEOF_INT128__
typedef unsigned __int128 u128;
static const u128 UINT128_MAX = (~(u128)0);
#endif
typedef uint64_t u64;
typedef uint32_t u32;
typedef uint16_t u16;
typedef uint8_t u8;

#ifdef __SIZEOF_INT128__
typedef __int128 i128;
#endif
typedef int64_t i64;
typedef int32_t i32;
typedef int16_t i16;
typedef int8_t i8;

typedef SolPubkey address;
static const address ADDRESS_ZERO = {};
static const address SYSTEM_PROGRAM_ID = {};
static const address ALT_PROGRAM_ID = {
    .x = {// AddressLookupTab1e1111111111111111111111111
          2, 119, 166, 175, 151, 51,  155, 122, 200, 141, 24, 146, 201, 4, 70, 245,
          0, 2,   48,  146, 102, 246, 46,  83,  193, 24,  36, 73,  130, 0, 0,  0
    }
};
static const address TOKEN_PROGRAM_ID = {
    .x = {// TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
          6,  221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70,  206, 235, 121, 172,
          28, 180, 133, 237, 95,  91,  55,  145, 58,  140, 245, 133, 126, 255, 0,   169
    }
};
static const address ATA_PROGRAM_ID = {
    .x = {// ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
          140, 151, 37, 143, 78,  36,  137, 241, 187, 61,  16,  41,  20,  142, 13,  131,
          11,  90,  19, 153, 218, 255, 16,  132, 4,   142, 123, 216, 219, 233, 248, 89
    }
};
static const address METAPLEX_PROGRAM_ID = {
    .x = {// metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
          11, 112, 101, 177, 227, 209, 124, 69,  56, 157, 82,  127, 107, 4,   195, 205,
          88, 184, 108, 115, 26,  160, 253, 181, 73, 182, 209, 188, 3,   248, 41,  70
    }
};
static const address ED25519_PROGRAM_ID = {
    .x = {//Ed25519SigVerify111111111111111111111111111
          3, 125, 70,  214, 124, 147, 251, 190, 18,  249, 66,  143, 131, 141, 64, 255,
          5, 112, 116, 73,  39,  244, 138, 100, 252, 202, 112, 68,  128, 0,   0,  0
    }
};
static const address IX_PROGRAM_ID = {
    .x = {//Sysvar1nstructions1111111111111111111111111
          6,   167, 213, 23,  24, 123, 209, 102, 53,  218, 212, 4,  85, 253, 194, 192,
          193, 36,  198, 143, 33, 86,  117, 165, 219, 186, 203, 95, 8,  0,   0,   0
    }
};
static const address COMPUTE_BUDGET_PROGRAM_ID = {
    .x = {//ComputeBudget111111111111111111111111111111
          3,   6,   70,  111, 229, 33,  23, 50,  255, 236, 173, 186, 114, 195, 155, 231,
          188, 140, 229, 187, 197, 247, 18, 107, 44,  67,  155, 58,  64,  0,   0,   0
    }
};
static const address WSOL_MINT = {
    .x = {//So11111111111111111111111111111111111111112
          6,   155, 136, 87,  254, 171, 129, 132, 251, 104, 127, 99, 70, 24, 192, 53,
          218, 196, 57,  220, 26,  235, 59,  85,  152, 160, 240, 0,  0,  0,  0,   1
    }
};

static bool address_equal(const address* lhs, const address* rhs) {
    const u64* a = (const u64*)lhs->x;
    const u64* b = (const u64*)rhs->x;
    for (u64 i = 0; i < 4; i++) {
        if (a[i] != b[i]) {
            return false;
        }
    }
    return true;
}

static NOINLINE void require(bool condition, const char* msg) {
    // Early return if condition is met
    if (condition) {
        return;
    }

    // Create temporary buffer
    // NOINLINE means that `err_buf` is guaranteed to exist
    // on a separate stack frame, ensuring this function
    // won't cause an overflow of the 4KB stack frame limit
    char err_buf[1024];
    const char* err_prefix = "Error: ";
    const u64 prefix_length = sol_strlen(err_prefix);
    u64 msg_length = sol_strlen(msg);

    // Handle oversized messages
    if (msg_length > sizeof(err_buf) - prefix_length) {
        msg = "message passed to `require` too large";
        msg_length = sol_strlen(msg);
    }

    // Construct error message
    sol_memcpy(err_buf, err_prefix, prefix_length);
    sol_memcpy(err_buf + prefix_length, msg, msg_length);

    // Log the error and terminate
    sol_log_(err_buf, prefix_length + msg_length);
    sol_panic();

    // Unreachable code
    while (true) {
    }
}

typedef struct {
    u8 x[8];
} bytes8;
static u64 bytes8_to_u64(bytes8 b) {
    return *(u64*)b.x;
}
static bytes8 bytes8_from_u64(u64 v) {
    bytes8 b;
    *(u64*)b.x = v;
    return b;
}

typedef struct {
    u8 x[16];
} bytes16;
typedef struct {
    u8 x[32];
} bytes32;
typedef struct {
    u8 x[64];
} bytes64;
typedef struct {
    u8 x[128];
} bytes128;

typedef SolSignerSeed slice;
/// Creates a new slice from `ptr` and `len`; this is borrowed memory,
/// and must not outlive `ptr`.
static slice slice_new(const u8* ptr, u64 len) {
    return (slice){.addr = ptr, .len = len};
}
/// Creates a slice from an address `a`. This is borrowed memory,
/// and must not outlive `address`.
static slice slice_from_address(const address* a) {
    return (slice){.addr = a->x, .len = sizeof(a->x)};
}
/// Creates a slice from a string `str`. This is borrowed memory,
/// and must not outlive `str`.
static slice slice_from_str(const char* str) {
    return (slice){.addr = (const u8*)str, .len = sol_strlen(str)};
}
/// Creates a slice from a string `str`, but not reading beyond `maxlen`
/// bytes. This is borrowed memory, and must not outlive `str`.
static slice slice_from_str_safe(const void* str, u64 maxlen) {
    u64 len;
    for (len = 0; len < maxlen; len++) {
        if (((const u8*)str)[len] == 0) {
            break;
        }
    }
    return (slice){.addr = (const u8*)str, .len = len};
}
/// Creates a slice from a bytes32 `b`. This is borrowed memory,
/// and must not outlive `b`.
static slice slice_from_bytes32(const bytes32* b) {
    return (slice){.addr = b->x, .len = sizeof(b->x)};
}
/// Creates a slice from a bytes64 `b`. This is borrowed memory,
/// and must not outlive `b`.
static slice slice_from_bytes64(const bytes64* b) {
    return (slice){.addr = b->x, .len = sizeof(b->x)};
}

typedef struct {
    address key;
    u8 nonce;
} ProgramDerivedAddress;

/// Infallible program address finding
static ProgramDerivedAddress find_program_address(
    const slice* seeds, u64 seeds_len, address program_id, const char* msg
) {
    ProgramDerivedAddress pda;
    require(
        !sol_try_find_program_address(
            seeds, seeds_len, &program_id, &pda.key, &pda.nonce
        ),
        msg
    );
    return pda;
}

/// Infallible program address creation
static address create_program_address(
    const slice* seeds, u64 seeds_len, address program_id, const char* msg
) {
    address a;
    require(!sol_create_program_address(seeds, seeds_len, &program_id, &a), msg);
    return a;
}

/// Does the given account exist on-chain?
static bool account_exists(const SolAccountInfo* info) {
    return info->data_len > 0 || (*info->lamports) > 0;
}

/// Compares two slices for equality.
/// Returns true if both slices have the same length and content, false otherwise.
static bool slice_equal(const slice* lhs, const slice* rhs) {
    if (lhs->len != rhs->len) {
        return false;
    }
    // Use memcmp for efficient byte comparison. Returns 0 if equal.
    return sol_memcmp(lhs->addr, rhs->addr, lhs->len) == 0;
}

/// Refresh a SolAccountInfo's `data_len` field, if the caller
/// suspects that it may have changed on-chain since program startup.
///
/// This is unfortunately necessary because for some reason, SolAccountInfo
/// chooses to store only a `u64 data_len` instead of the more pragmatic
/// `u64* data_len` (which, as a bonus, would allow users to easily realloc
/// accounts).
static void sol_refresh_data_len(SolAccountInfo* info) {
    info->data_len = *(u64*)(info->data - 8);
}

/// Maximum permitted size of account data
static const u64 MAX_PERMITTED_DATA_LENGTH = 10 * 1024 * 1024;

/// Realloc the account's data, increasing or decreasing
/// its size. This will update `info->data_len`.
///
/// NOTE: Usually, this function must be coupled with a
///       balance adjustment, to ensure that the account
///       still meets the rent exemption threshold.
static void sol_realloc(SolAccountInfo* info, u64 new_len) {
    // Return early if length unchanged
    u64 old_len = *(u64*)(info->data - 8);
    if (old_len == new_len) {
        return;
    }

    // original data len is serialized as a u32 to the
    // 4 bytes immediately preceding the account key
    u32 original_data_len = *(u32*)(((const u8*)info->key) - 4);
    require(
        new_len < original_data_len ||
            (new_len - original_data_len) <= MAX_PERMITTED_DATA_INCREASE,
        "Invalid realloc: data increase too large for one transaction"
    );
    require(
        new_len <= MAX_PERMITTED_DATA_LENGTH,
        "Invalid realloc: new account data length exceeds maximum"
    );

    // Update length in serialized data
    *(u64*)(info->data - 8) = new_len;

    // Update length in userspace
    info->data_len = new_len;

    // Zero new memory
    if (new_len > old_len) {
        sol_memset(info->data + old_len, 0, new_len - old_len);
    }
}

/// Close the account `source`, transferring the lamports to `destination`.
/// The current program must own `source`.
static void sol_close_account(
    SolAccountInfo* source, const SolAccountInfo* destination
) {
    // 1) Drain source account of lamports
    *destination->lamports += *source->lamports;
    *source->lamports = 0;

    // 2) Reassign source account to system program
    *source->owner = SYSTEM_PROGRAM_ID;

    // 3) Set source account data length to 0
    *(u64*)(source->data - 8) = 0; // vmspace
    source->data_len = 0; // userspace
}

typedef struct {
    /// The current network/bank slot
    u64 slot;
    /// The timestamp of the first slot in this Epoch
    i64 epoch_start_timestamp;
    /// The bank epoch
    u64 epoch;
    /// The future epoch for which the leader schedule has
    ///  most recently been calculated
    u64 leader_schedule_epoch;
    /// Originally computed from genesis creation time and network time
    /// in slots (drifty); corrected using validator timestamp oracle as of
    /// timestamp_correction and timestamp_bounding features
    /// An approximate measure of real-world time, expressed as Unix time
    /// (i.e. seconds since the Unix epoch)
    i64 unix_timestamp;
} Clock;

extern u64 sol_get_clock_sysvar(Clock* c);

/// Finds the first occurrence of `ch` in the initial `count` bytes
/// (each interpreted as `unsigned char`) of the object pointed to by `ptr`.
static const void* sol_memchr(const void* ptr, u8 ch, u64 count) {
    const u8* p = (const u8*)ptr;
    while (count) {
        if (*p == ch) {
            return p;
        }
        p++;
        count--;
    }
    return NULL;
}

#endif
