#ifndef IVY_PACKED_H
#define IVY_PACKED_H

#if defined(__GNUC__) || defined(__clang__)
    #define packed __attribute__((packed))
#else
    #error Unsupported compiler for `packed`
#endif

#endif
