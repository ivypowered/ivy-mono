#ifndef IVY_SAFE_MATH_H
#define IVY_SAFE_MATH_H

#include "lib/types.h"

/** Provides safe operations for u64 */

static u64 safe_add_64(u64 a, u64 b) {
    require(a <= UINT64_MAX - b, "u64 addition overflow");
    return a + b;
}

static u64 safe_sub_64(u64 a, u64 b) {
    require(a >= b, "u64 subtraction underflow");
    return a - b;
}

static u64 safe_mul_64(u64 a, u64 b) {
    require(b == 0 || a <= UINT64_MAX / b, "u64 multiplication overflow");
    return a * b;
}

static u64 safe_div_64(u64 a, u64 b) {
    require(b != 0, "u64 division by zero");
    return a / b;
}

/**
 * @notice Safely multiply two uint64 values and then divide by a third
 *         Rounds towards zero
 * @dev Ensures no overflow occurs during multiplication by using uint128
 * @param a First multiplication operand
 * @param b Second multiplication operand
 * @param c Divisor
 * @return Result of (a * b) / c as uint64
 */
static u64 safe_mul_div_64(u64 a, u64 b, u64 c) {
    require(c != 0, "Division by zero");

    u128 product = (u128)(a) * (u128)(b);

    u128 result = product / c;

    // Check if result fits in u64
    require(result <= UINT64_MAX, "Result overflows u64");

    return (u64)result;
}

/**
 * @notice Safely multiply two uint64 values and then divide by a third
 *         Rounds towards infinity
 * @dev Ensures no overflow occurs during multiplication by using uint128
 * @param a First multiplication operand
 * @param b Second multiplication operand
 * @param c Divisor
 * @return Result of (a * b) / c as uint64
 */
static u64 safe_mul_div_ceil_64(u64 a, u64 b, u64 c) {
    require(c != 0, "Division by zero");

    u128 product = (u128)(a) * (u128)(b);

    // If product is 0, the result is 0
    if (product == 0) {
        return 0;
    }

    // Note: Since we already checked a > 0, (a-1) won't underflow
    u128 result = ((product - 1) / c) + 1;

    // Check if result fits in u64
    require(result <= UINT64_MAX, "Result overflows u64");

    return (u64)result;
}

#endif // IVY_SAFE_MATH_H
