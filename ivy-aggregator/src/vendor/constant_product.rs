/**
 * The following code is adapted from raydium-io/raydium-cp-swap
 * Copyright 2024 Raydium Protocol
 * Licensed under the Apache License, Version 2.0 (see LICENSE-APACHE in this directory)
 *
 * Changes made: Functions now return Option<u128> instead of using `unwrap()`
 *               and added `current_price`
 */
#[allow(dead_code)]
trait CheckedCeilDiv: Sized {
    /// Perform ceiling division
    fn checked_ceil_div(&self, rhs: Self) -> Option<(Self, Self)>;
}

impl CheckedCeilDiv for u128 {
    fn checked_ceil_div(&self, mut rhs: Self) -> Option<(Self, Self)> {
        let mut quotient = self.checked_div(rhs)?;
        // Avoid dividing a small number by a big one and returning 1, and instead
        // fail.
        if quotient == 0 {
            // return None;
            if self.checked_mul(2 as u128)? >= rhs {
                return Some((1, 0));
            } else {
                return Some((0, 0));
            }
        }

        // Ceiling the destination amount if there's any remainder, which will
        // almost always be the case.
        let remainder = self.checked_rem(rhs)?;
        if remainder > 0 {
            quotient = quotient.checked_add(1)?;
            // calculate the minimum amount needed to get the dividend amount to
            // avoid truncating too much
            rhs = self.checked_div(quotient)?;
            let remainder = self.checked_rem(quotient)?;
            if remainder > 0 {
                rhs = rhs.checked_add(1)?;
            }
        }
        Some((quotient, rhs))
    }
}

/// ConstantProductCurve struct implementing CurveCalculator
#[derive(Clone, Debug, Default, PartialEq)]
pub struct ConstantProductCurve;

impl ConstantProductCurve {
    /// Constant product swap ensures x * y = constant
    /// The constant product swap calculation, factored out of its class for reuse.
    ///
    /// This is guaranteed to work for all values such that:
    ///  - 1 <= swap_source_amount * swap_destination_amount <= u128::MAX
    ///  - 1 <= source_amount <= u64::MAX
    pub fn swap_base_input_without_fees(
        source_amount: u128,
        swap_source_amount: u128,
        swap_destination_amount: u128,
    ) -> Option<u128> {
        // (x + delta_x) * (y - delta_y) = x * y
        // delta_y = (delta_x * y) / (x + delta_x)
        let numerator = source_amount.checked_mul(swap_destination_amount)?;
        let denominator = swap_source_amount.checked_add(source_amount)?;
        let destination_amount_swapped = numerator.checked_div(denominator)?;
        Some(destination_amount_swapped)
    }

    #[allow(dead_code)]
    pub fn swap_base_output_without_fees(
        destination_amount: u128,
        swap_source_amount: u128,
        swap_destination_amount: u128,
    ) -> Option<u128> {
        // (x + delta_x) * (y - delta_y) = x * y
        // delta_x = (x * delta_y) / (y - delta_y)
        let numerator = swap_source_amount.checked_mul(destination_amount)?;
        let denominator = swap_destination_amount.checked_sub(destination_amount)?;
        let (source_amount_swapped, _) = numerator.checked_ceil_div(denominator)?;
        Some(source_amount_swapped)
    }
}
