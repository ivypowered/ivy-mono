#ifndef IVY_CP_CURVE_H
#define IVY_CP_CURVE_H

#include "safe_math.h"
#include <ivy-lib/types.h>

/**
 * @title cp_curve
 * @dev Functions for constant product AMM curve calculations
 */

/**
 * @notice Sell exact amount of X tokens to receive Y tokens
 * @param x Amount of X tokens in the pool
 * @param y Amount of Y tokens in the pool
 * @param dx Amount of X tokens to sell
 * @return Amount of Y tokens received
 */
static u64 cp_curve_exact_in(u64 x, u64 y, u64 dx) {
    // Calculate output amount using constant product formula
    // xy = k = (x + Δx)(y - Δy)
    // xy = (x + Δx)(y - Δy)
    // xy = xy - xΔy + Δxy - ΔxΔy
    // 0 = -xΔy + Δxy - ΔxΔy
    // xΔy = Δxy - ΔxΔy
    // xΔy + ΔxΔy = Δxy
    // Δy(x + Δx) = Δxy
    // Δy = (Δxy) / (x + Δx)
    u64 dy = safe_mul_div_64(dx, y, safe_add_64(x, dx));
    require(y >= dy, "Insufficient liquidity");
    return dy;
}

/**
 * @notice Buy exact amount of Y tokens by providing X tokens
 * @param x Amount of X tokens in the pool
 * @param y Amount of Y tokens in the pool
 * @param dy Amount of Y tokens to buy
 * @return Amount of X tokens required
 */
static u64 cp_curve_exact_out(u64 x, u64 y, u64 dy) {
    // Check if there's sufficient liquidity
    require(y > dy, "Insufficient Y liquidity");

    // Calculate input amount using constant product formula
    // Use divCeil so that protocol does not get shortchanged on input amount
    // xy = k = (x + Δx)(y - Δy)
    // xy = (x + Δx)(y - Δy)
    // xy = xy - xΔy + Δxy - ΔxΔy
    // 0 = -xΔy + Δxy - ΔxΔy
    // xΔy = Δxy - ΔxΔy
    // xΔy = Δx(y - Δy)
    // Δx = (xΔy) / (y - Δy)
    return safe_mul_div_ceil_64(x, dy, safe_sub_64(y, dy));
}

#endif /* IVY_CP_CURVE_H */
