#ifndef IVY_RW_H
#define IVY_RW_H

#include "heap.h"
#include "types.h"

/* NOTE: When reading this file, be aware that
         Solana allows unaligned memory accesses!
         This simplifies some of the logic :) */

typedef struct {
    const u8* ptr;
    u64 len;
    u64 offset;
} reader;

/// Creates a new reader from a pointer and length
static reader reader_new(const u8* ptr, u64 len) {
    // basic protection against invalid lengths (memory corruption elsewhere)
    require(len < (UINT64_MAX >> 1), "Insane length provided to reader_new");
    return (reader){.ptr = ptr, .len = len, .offset = 0};
}

/// Read a u8 and advance the offset
static u8 reader_read_u8(reader* r) {
    require(r->offset + sizeof(u8) <= r->len, "Reader buffer overflow");
    u8 val = r->ptr[r->offset];
    r->offset += sizeof(u8);
    return val;
}

/// Read a u16 and advance the offset
static u16 reader_read_u16(reader* r) {
    require(r->offset + sizeof(u16) <= r->len, "Reader buffer overflow");
    u16 val = *((u16*)(r->ptr + r->offset));
    r->offset += sizeof(u16);
    return val;
}

/// Read a u32 and advance the offset
static u32 reader_read_u32(reader* r) {
    require(r->offset + sizeof(u32) <= r->len, "Reader buffer overflow");
    u32 val = *((u32*)(r->ptr + r->offset));
    r->offset += sizeof(u32);
    return val;
}

/// Read a u64 and advance the offset
static u64 reader_read_u64(reader* r) {
    require(r->offset + sizeof(u64) <= r->len, "Reader buffer overflow");
    u64 val = *((u64*)(r->ptr + r->offset));
    r->offset += sizeof(u64);
    return val;
}

/// Read an i8 and advance the offset
static i8 reader_read_i8(reader* r) {
    require(r->offset + sizeof(i8) <= r->len, "Reader buffer overflow");
    i8 val = *((i8*)(r->ptr + r->offset));
    r->offset += sizeof(i8);
    return val;
}

/// Read an i16 and advance the offset
static i16 reader_read_i16(reader* r) {
    require(r->offset + sizeof(i16) <= r->len, "Reader buffer overflow");
    i16 val = *((i16*)(r->ptr + r->offset));
    r->offset += sizeof(i16);
    return val;
}

/// Read an i32 and advance the offset
static i32 reader_read_i32(reader* r) {
    require(r->offset + sizeof(i32) <= r->len, "Reader buffer overflow");
    i32 val = *((i32*)(r->ptr + r->offset));
    r->offset += sizeof(i32);
    return val;
}

/// Read an i64 and advance the offset
static i64 reader_read_i64(reader* r) {
    require(r->offset + sizeof(i64) <= r->len, "Reader buffer overflow");
    i64 val = *((i64*)(r->ptr + r->offset));
    r->offset += sizeof(i64);
    return val;
}

/// Read an address and advance the offset
static address reader_read_address(reader* r) {
    require(r->offset + sizeof(address) <= r->len, "Reader buffer overflow");
    address val;
    sol_memcpy(&val, r->ptr + r->offset, sizeof(address));
    r->offset += sizeof(address);
    return val;
}

/// Read an owned sub-slice and advance the offset
static slice reader_read_slice(reader* r, u64 length) {
    require(
        r->offset <= UINT64_MAX - length && r->offset + length <= r->len,
        "Reader buffer overflow"
    );
    u8* data = (u8*)heap_alloc(length); // heap_alloc uses require internally
    sol_memcpy(data, r->ptr + r->offset, length);
    slice val = slice_new(data, length);
    r->offset += length;
    return val;
}

/// Read a borrowed sub-slice and advance the offset.
/// The returned slice points directly into the reader's buffer.
/// WARNING: The slice is only valid as long as the reader's buffer is valid.
static slice reader_read_slice_borrowed(reader* r, u64 length) {
    require(
        r->offset <= UINT64_MAX - length && r->offset + length <= r->len,
        "Reader buffer overflow (borrowed slice)"
    );
    slice val = slice_new(r->ptr + r->offset, length); // Borrow directly
    r->offset += length;
    return val;
}

/// Peek at the next byte without advancing the offset
static u8 reader_peek_u8(const reader* r) {
    require(r->offset + sizeof(u8) <= r->len, "Reader buffer overflow");
    return r->ptr[r->offset];
}

/// Set the reader's internal offset to a specific absolute position.
static void reader_seek(reader* r, u64 absolute_offset) {
    require(absolute_offset <= r->len, "Reader seek out of bounds");
    r->offset = absolute_offset;
}

/// Skip a number of bytes
static void reader_skip(reader* r, u64 count) {
    require(
        r->offset <= UINT64_MAX - count && r->offset + count <= r->len,
        "Reader buffer overflow"
    );
    r->offset += count;
}

/// Check if the reader has reached the end
static bool reader_is_done(const reader* r) {
    return r->offset >= r->len;
}

/// Get remaining bytes
static u64 reader_remaining(const reader* r) {
    if (r->len < r->offset) {
        return 0;
    }
    return r->len - r->offset;
}

typedef struct {
    u8* ptr;
    u64 len;
    u64 offset;
} writer;

/// Creates a new writer from a writable memory area
static writer writer_new(u8* ptr, u64 len) {
    // basic protection against invalid lengths (memory corruption elsewhere)
    require(len < (UINT64_MAX >> 2), "Insane length provided to writer");
    return (writer){.ptr = ptr, .len = len, .offset = 0};
}

/// Write a u8 and advance the offset
static void writer_write_u8(writer* w, u8 val) {
    require(w->offset + sizeof(u8) <= w->len, "Writer buffer overflow");
    w->ptr[w->offset] = val;
    w->offset += sizeof(u8);
}

/// Write a u16 and advance the offset
static void writer_write_u16(writer* w, u16 val) {
    require(w->offset + sizeof(u16) <= w->len, "Writer buffer overflow");
    *((u16*)(w->ptr + w->offset)) = val;
    w->offset += sizeof(u16);
}

/// Write a u32 and advance the offset
static void writer_write_u32(writer* w, u32 val) {
    require(w->offset + sizeof(u32) <= w->len, "Writer buffer overflow");
    *((u32*)(w->ptr + w->offset)) = val;
    w->offset += sizeof(u32);
}

/// Write a u64 and advance the offset
static void writer_write_u64(writer* w, u64 val) {
    require(w->offset + sizeof(u64) <= w->len, "Writer buffer overflow");
    *((u64*)(w->ptr + w->offset)) = val;
    w->offset += sizeof(u64);
}

/// Write an i8 and advance the offset
static void writer_write_i8(writer* w, i8 val) {
    require(w->offset + sizeof(i8) <= w->len, "Writer buffer overflow");
    *((i8*)(w->ptr + w->offset)) = val;
    w->offset += sizeof(i8);
}

/// Write an i16 and advance the offset
static void writer_write_i16(writer* w, i16 val) {
    require(w->offset + sizeof(i16) <= w->len, "Writer buffer overflow");
    *((i16*)(w->ptr + w->offset)) = val;
    w->offset += sizeof(i16);
}

/// Write an i32 and advance the offset
static void writer_write_i32(writer* w, i32 val) {
    require(w->offset + sizeof(i32) <= w->len, "Writer buffer overflow");
    *((i32*)(w->ptr + w->offset)) = val;
    w->offset += sizeof(i32);
}

/// Write an i64 and advance the offset
static void writer_write_i64(writer* w, i64 val) {
    require(w->offset + sizeof(i64) <= w->len, "Writer buffer overflow");
    *((i64*)(w->ptr + w->offset)) = val;
    w->offset += sizeof(i64);
}

/// Write an address and advance the offset
static void writer_write_address(writer* w, const address* val) {
    require(w->offset + sizeof(address) <= w->len, "Writer buffer overflow");
    sol_memcpy(w->ptr + w->offset, val, sizeof(address));
    w->offset += sizeof(address);
}

/// Write a bytes32 and advance the offset
static void writer_write_bytes32(writer* w, const bytes32* val) {
    require(w->offset + sizeof(bytes32) <= w->len, "Writer buffer overflow");
    sol_memcpy(w->ptr + w->offset, val, sizeof(bytes32));
    w->offset += sizeof(bytes32);
}

/// Write a slice and advance the offset
static void writer_write_slice(writer* w, const slice val) {
    require(w->offset + val.len <= w->len, "Writer buffer overflow");
    sol_memcpy(w->ptr + w->offset, val.addr, val.len);
    w->offset += val.len;
}

/// Skip a number of bytes
static void writer_skip(writer* w, u64 count) {
    require(
        w->offset <= UINT64_MAX - count && w->offset + count <= w->len,
        "Writer buffer overflow"
    );
    w->offset += count;
}

/// Get remaining buffer capacity
static u64 writer_remaining(const writer* w) {
    if (w->len < w->offset) {
        return 0;
    }
    return w->len - w->offset;
}

/// Convert the writer to a slice of written data
static slice writer_to_slice(const writer* w) {
    return slice_new(w->ptr, w->offset);
}

#endif
