#ifndef IVY_RENT_H
#define IVY_RENT_H

/*
 * C implementation of Solana rent calculation
 * Based on: https://github.com/solana-labs/solana/blob/master/sdk/program/src/rent.rs
 */

#include "types.h"

/* Default rental rate in lamports/byte-year */
static const u64 DEFAULT_LAMPORTS_PER_BYTE_YEAR =
    ((UINT64_C(1000000000) / 100) * 365) / (1024 * 1024);

/* Default exemption time in years */
static const u64 DEFAULT_EXEMPTION_THRESHOLD = 2;

/* Account storage overhead bytes */
static const u64 ACCOUNT_STORAGE_OVERHEAD = 128;

/* Calculate minimum balance for rent-exemption given data size */
static u64 minimum_balance(u64 data_len) {
    return ((ACCOUNT_STORAGE_OVERHEAD + data_len) * DEFAULT_LAMPORTS_PER_BYTE_YEAR) *
        DEFAULT_EXEMPTION_THRESHOLD;
}

#endif
