#ifndef IVY_HEAP_H
#define IVY_HEAP_H

#include "types.h"
#include <solana_sdk.h>

/// Simple bump allocator with 8-byte alignment.
static void* heap_alloc(u64 size) {
    // Get current heap size from the size header
    u64 heap_size = *(u64*)(HEAP_START_ADDRESS);
    // Calculate the next aligned offset
    u64 offset = (heap_size + 7) & ~7ULL;
    // Calculate the new heap size after allocation
    u64 new_heap_size = offset + size;
    // Check if allocation exceeds heap bounds (accounting for 8 byte size header)
    require(
        (new_heap_size + 8) <= HEAP_LENGTH, "Heap allocation failed: out of memory"
    );

    // Update the heap size at the start address
    *(u64*)HEAP_START_ADDRESS = new_heap_size;
    // Return the pointer to the allocated block (skip the 8-byte size header)
    return (u8*)(HEAP_START_ADDRESS) + 8 + offset;
}

/// Same as `heap_alloc`, but zeroes the allocation
/// before returning it.
static void* heap_alloc_zeroed(u64 size) {
    void* data = heap_alloc(size);
    sol_memset(data, 0, size);
    return data;
}

#endif
