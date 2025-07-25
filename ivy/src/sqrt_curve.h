#ifndef IVY_SQRT_CURVE_H
#define IVY_SQRT_CURVE_H

// clang-format off
#include <ivy-lib/types.h>
#include "import/r128.h"
// clang-format on

/**
 * @title SqrtCurve
 * @dev Library for square root bonding curve calculations
 */

/**
  * @notice Compute y = (2/3)(sqrt(c)b^(3/2) - sqrt(c)a^(3/2)) using fixed-point arithmetic
  * @param input_scale The scaling factor c
  * @param a The lower bound
  * @param b The upper bound
  * @return The result of the integration
  */
static r128 integrate_sqrt(r128 input_scale, r128 a, r128 b, bool round_up) {
    // Early return if b <= a to save gas
    if (r128_cmp(b, a) <= 0) {
        return r128_from_u64(0);
    }

    // Compute sqrt(c)a^(3/2) as a * sqrt(ca)
    // If we're rounding up, round down this term (it's negative)
    r128 a_scale_product = r128_mul(a, input_scale);
    r128 sqrt_a_scale =
        round_up ? r128_sqrt(a_scale_product) : r128_sqrt_ceil(a_scale_product);
    r128 a_term = r128_mul(a, sqrt_a_scale);

    // Compute sqrt(c)b^(3/2) as b * sqrt(cb)
    // If we're rounding up, round up this term (it's positive)
    r128 b_scale_product = r128_mul(b, input_scale);
    r128 sqrt_b_scale =
        round_up ? r128_sqrt_ceil(b_scale_product) : r128_sqrt(b_scale_product);
    r128 b_term = r128_mul(b, sqrt_b_scale);

    // Compute (sqrt(c)b^(3/2) - sqrt(c)a^(3/2))
    // Since we checked b > a earlier, b_term > a_term is guaranteed
    // because both functions are monotonically increasing
    r128 diff = r128_sub(b_term, a_term);

    // Calculate (2/3) * diff using fixed-point arithmetic
    // Multiply by 2 first, then divide by 3
    r128 two = r128_from_u64(2);
    r128 three = r128_from_u64(3);
    r128 diff_times_2 = r128_mul(diff, two);

    if (round_up) {
        return r128_div_ceil(diff_times_2, three);
    } else {
        return r128_div(diff_times_2, three);
    }
}

/**
  * @notice Given area under sqrt(cx) curve from a to b, computes the left bound a.
  * @dev Solves for a in the equation: y = integral(sqrt(cx)dx, a->b)
  *
  * Mathematical derivation:
  * y = (2/3)sqrt(c)(b^(3/2) - a^(3/2))
  * y = (2/3)sqrt(c)b^(3/2) - (2/3)sqrt(c)a^(3/2)
  * (2/3)sqrt(c)a^(3/2) = (2/3)sqrt(c)b^(3/2) - y
  * a^(3/2) = b^(3/2) - (y/((2/3) * sqrt(c)))
  * a^(3/2) = b^(3/2) - (3y)/(2sqrt(c))
  * a^(3/2) = b^(3/2) - (3y)/sqrt(4c)
  * a = (b^(3/2) - (3y)/sqrt(4c))^(2/3)
  * a = ((b^(3/2) - (3y)/sqrt(4c))^(1/3))^2
  *
  * @param input_scale The scaling factor c
  * @param area The area under the curve (y)
  * @param b The right bound
  * @return The left bound a as r128
  */
static r128 get_sqrt_integral_left_bound(
    r128 input_scale, r128 area, r128 b, bool round_up
) {
    // Require input_scale != 0
    require(!r128_is_zero(input_scale), "Scale cannot be 0");

    // b^(3/2) as b * sqrt(b)
    // round up, term is positive
    r128 sqrt_b = round_up ? r128_sqrt_ceil(b) : r128_sqrt(b);
    r128 b_term = r128_mul(b, sqrt_b);

    // sqrt(4c)
    // round up, yc_term is negative BUT c_term is in denominator
    r128 four = r128_from_u64(4);
    r128 c_term_input = r128_mul(four, input_scale);
    r128 c_term = round_up ? r128_sqrt_ceil(c_term_input) : r128_sqrt(c_term_input);

    // 3y
    r128 three = r128_from_u64(3);
    r128 y_term = r128_mul(three, area);

    // (3y)/sqrt(4c)
    // if rounding up, round down (term is negative)
    r128 yc_term;
    if (round_up) {
        yc_term = r128_div(y_term, c_term);
    } else {
        yc_term = r128_div_ceil(y_term, c_term);
    }

    // Check if b_term < yc_term
    if (r128_cmp(b_term, yc_term) < 0) {
        // our result will be negative
        return r128_from_u64(0);
    }

    // ((b^(3/2) - (3y)/sqrt(4c))^(1/3))
    r128 b_minus_yc_term = r128_sub(b_term, yc_term);
    // ^(1/3)
    r128 r = round_up ? r128_cbrt_ceil(b_minus_yc_term) : r128_cbrt(b_minus_yc_term);

    // Calculate r^2
    return r128_mul(r, r);
}

/**
  * @notice Given area under sqrt(cx) curve from a to b, computes the right bound b.
  * @dev Solves for b in the equation: y = integral(sqrt(cx)dx, a->b)
  *
  * Mathematical derivation:
  * y = (2/3)sqrt(c)(b^(3/2) - a^(3/2))
  * y = (2/3)sqrt(c)b^(3/2) - (2/3)sqrt(c)a^(3/2)
  * (2/3)sqrt(c)b^(3/2) = y + (2/3)sqrt(c)a^(3/2)
  * b^(3/2) = (y/((2/3) * sqrt(c))) + a^(3/2)
  * b^(3/2) = (3y)/(2sqrt(c)) + a^(3/2)
  * b^(3/2) = (3y)/sqrt(4c) + a^(3/2)
  * b = ((3y)/sqrt(4c) + a^(3/2))^(2/3)
  * b = (((3y)/sqrt(4c) + a^(3/2))^(1/3))^2
  *
  * @param input_scale The scaling factor c
  * @param area The area under the curve (y)
  * @param a The left bound
  * @param round_up Whether to round up the result
  * @return The right bound b as r128
  */
static r128 get_sqrt_integral_right_bound(
    r128 input_scale, r128 area, r128 a, bool round_up
) {
    require(!r128_is_zero(input_scale), "Scale cannot be zero");

    // sqrt(4c)
    // round down, yc_term is positive but c_term is in denominator
    r128 four = r128_from_u64(4);
    r128 c_term_input = r128_mul(four, input_scale);
    r128 c_term = round_up ? r128_sqrt(c_term_input) : r128_sqrt_ceil(c_term_input);

    // 3y
    r128 three = r128_from_u64(3);
    r128 y_term = r128_mul(three, area);

    // (3y)/sqrt(4c)
    // if rounding up, use ceiling division (term is positive)
    r128 yc_term;
    if (round_up) {
        yc_term = r128_div_ceil(y_term, c_term);
    } else {
        yc_term = r128_div(y_term, c_term);
    }

    // a^(3/2) as a * sqrt(a)
    // if rounding up, round this term up (it's positive)
    r128 sqrt_a = round_up ? r128_sqrt_ceil(a) : r128_sqrt(a);
    r128 a_term = r128_mul(a, sqrt_a);

    // Calculate ((3y)/sqrt(4c) + a^(3/2))
    r128 sum = r128_add(yc_term, a_term);

    // ((3y)/sqrt(4c) + a^(3/2))^(1/3)
    r128 r = round_up ? r128_cbrt_ceil(sum) : r128_cbrt(sum);

    // Calculate r^2
    return r128_mul(r, r);
}

/**
 * @notice Calculate the amount of reserve tokens deposited to receive a specific amount of tokens
 * @param supply Current token supply
 * @param max_supply Maximum token supply
 * @param input_scale The scaling factor for price calculations
 * @param token_amount The number of tokens received
 * @return The amount of reserve tokens deposited
 */
static r128 sqrt_curve_exact_tokens_out(
    r128 supply, r128 max_supply, r128 input_scale, r128 token_amount
) {
    r128 new_supply = r128_add(supply, token_amount);
    require(
        r128_cmp(new_supply, max_supply) <= 0, "exactTokensOut: Insufficient supply"
    );

    // round up: user is depositing this amount
    return integrate_sqrt(input_scale, supply, new_supply, true);
}

/**
 * @notice Calculate the amount of reserve received for a token deposit amount
 * @param supply Current token supply
 * @param input_scale The scaling factor for price calculations
 * @param token_amount The number of tokens deposited
 * @return The amount of reserve tokens received
 */
static r128 sqrt_curve_exact_tokens_in(
    r128 supply, r128 input_scale, r128 token_amount
) {
    require(r128_cmp(token_amount, supply) <= 0, "exactTokensIn: Insufficient supply");

    r128 new_supply = r128_sub(supply, token_amount);

    // round down: user is receiving this amount
    return integrate_sqrt(input_scale, new_supply, supply, false);
}

/**
 * @notice Calculate the number of tokens received for a reserve deposit amount
 * @param supply Current token supply
 * @param max_supply Maximum token supply
 * @param input_scale The scaling factor for price calculations
 * @param reserve_amount The amount of reserve tokens to provide
 * @return The number of tokens received
 */
static r128 sqrt_curve_exact_reserve_in(
    r128 supply, r128 max_supply, r128 input_scale, r128 reserve_amount
) {
    // Calculate the new supply directly
    // Round down: user is receiving `new_supply - supply`,
    //             so we want to minimize `new_supply`
    r128 new_supply =
        get_sqrt_integral_right_bound(input_scale, reserve_amount, supply, false);

    // Check max supply
    require(
        r128_cmp(new_supply, max_supply) <= 0, "exactReserveIn: Exceeds maximum supply"
    );

    // Calculate actual tokens received
    return r128_sub(new_supply, supply);
}

/**
 * @notice Calculate the number of tokens that need to be provided to receive a specific amount of reserve tokens
 * @param supply Current token supply
 * @param input_scale The scaling factor for price calculations
 * @param reserve_amount The amount of reserve tokens to receive
 * @return The number of tokens required
 */
static r128 sqrt_curve_exact_reserve_out(
    r128 supply, r128 input_scale, r128 reserve_amount
) {
    // Calculate the new supply directly
    // Round down: user is paying (supply - new_supply),
    //             so we want to minimize `new_supply`
    r128 new_supply =
        get_sqrt_integral_left_bound(input_scale, reserve_amount, supply, false);

    require(r128_cmp(new_supply, supply) <= 0, "exactReserveOut: Insufficient supply");

    // Calculate tokens to be provided
    return r128_sub(supply, new_supply);
}

#endif // IVY_SQRT_CURVE_H
