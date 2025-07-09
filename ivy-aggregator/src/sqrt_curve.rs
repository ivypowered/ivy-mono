struct Math {}
impl Math {
    /// Compute the area under sqrt(cx) curve from a to b
    /// Formula: (2/3) * sqrt(c) * (b^(3/2) - a^(3/2))
    pub fn integrate_sqrt(c: f64, a: f64, b: f64, round_up: bool) -> f64 {
        if b <= a {
            return 0.0;
        }

        let sqrt_c = c.sqrt();
        let result = (2.0 / 3.0) * sqrt_c * (b.powf(1.5) - a.powf(1.5));

        if round_up {
            result.ceil()
        } else {
            result
        }
    }

    /*/// Given area under sqrt(cx) curve from a to b, compute the left bound a
    pub fn get_sqrt_integral_left_bound(c: f64, area: f64, b: f64, round_up: bool) -> f64 {
        assert!(c > 0.0, "Scale cannot be 0");

        // From the integration formula, we solve for a:
        // area = (2/3) * sqrt(c) * (b^(3/2) - a^(3/2))
        // a^(3/2) = b^(3/2) - (3 * area) / (2 * sqrt(c))
        // a = (b^(3/2) - (3 * area) / (2 * sqrt(c)))^(2/3)

        let sqrt_c = c.sqrt();
        let term = b.powf(1.5) - (3.0 * area) / (2.0 * sqrt_c);

        // If term is negative, the area is too large for the given b
        if term < 0.0 {
            return 0.0;
        }

        let result = term.powf(2.0 / 3.0);

        if round_up {
            result.ceil()
        } else {
            result
        }
    }*/

    /// Given area under sqrt(cx) curve from a to b, compute the right bound b
    pub fn get_sqrt_integral_right_bound(c: f64, area: f64, a: f64, round_up: bool) -> f64 {
        assert!(c > 0.0, "Scale cannot be zero");

        // From the integration formula, we solve for b:
        // area = (2/3) * sqrt(c) * (b^(3/2) - a^(3/2))
        // b^(3/2) = a^(3/2) + (3 * area) / (2 * sqrt(c))
        // b = (a^(3/2) + (3 * area) / (2 * sqrt(c)))^(2/3)

        let sqrt_c = c.sqrt();
        let term = a.powf(1.5) + (3.0 * area) / (2.0 * sqrt_c);
        let result = term.powf(2.0 / 3.0);

        if round_up {
            result.ceil()
        } else {
            result
        }
    }
}

pub struct SqrtCurve {}
impl SqrtCurve {
    /// Calculate the current price of the curve
    /// # Arguments
    ///
    /// * `supply` - Current token supply
    /// * `input_scale` - The scaling factor for price calculations
    ///
    /// # Returns
    /// The current price of the curve in raw reserve tokens
    pub fn current_price(supply: f64, input_scale: f64) -> f64 {
        (supply * input_scale).sqrt()
    }

    /*/// Calculate the amount of reserve tokens deposited to receive a specific amount of tokens
    ///
    /// # Arguments
    ///
    /// * `supply` - Current token supply
    /// * `max_supply` - Maximum token supply
    /// * `input_scale` - The scaling factor for price calculations
    /// * `token_amount` - The number of tokens received
    ///
    /// # Returns
    ///
    /// The amount of reserve tokens deposited
    pub fn exact_tokens_out(
        supply: f64,
        max_supply: f64,
        input_scale: f64,
        token_amount: f64,
    ) -> Result<f64, &'static str> {
        let new_supply = supply + token_amount;
        if new_supply > max_supply {
            return Err("exactTokensOut: Insufficient supply");
        }

        // Round up: user is depositing this amount
        Ok(Math::integrate_sqrt(input_scale, supply, new_supply, true))
    }*/

    /// Calculate the amount of reserve received for a token deposit amount
    ///
    /// # Arguments
    ///
    /// * `supply` - Current token supply
    /// * `input_scale` - The scaling factor for price calculations
    /// * `token_amount` - The number of tokens deposited
    ///
    /// # Returns
    ///
    /// The amount of reserve tokens received
    pub fn exact_tokens_in(
        supply: f64,
        input_scale: f64,
        token_amount: f64,
    ) -> Result<f64, &'static str> {
        if token_amount > supply {
            return Err("exactTokensIn: Insufficient supply");
        }

        let new_supply = supply - token_amount;

        // Round down: user is receiving this amount
        Ok(Math::integrate_sqrt(input_scale, new_supply, supply, false))
    }

    /// Calculate the number of tokens received for a reserve deposit amount
    ///
    /// # Arguments
    ///
    /// * `supply` - Current token supply
    /// * `max_supply` - Maximum token supply
    /// * `input_scale` - The scaling factor for price calculations
    /// * `reserve_amount` - The amount of reserve tokens to provide
    ///
    /// # Returns
    ///
    /// The number of tokens received
    pub fn exact_reserve_in(
        supply: f64,
        max_supply: f64,
        input_scale: f64,
        reserve_amount: f64,
    ) -> Result<f64, &'static str> {
        // Calculate the new supply directly
        // Round down: user is receiving `new_supply - supply`,
        // so we want to minimize `new_supply`
        let new_supply =
            Math::get_sqrt_integral_right_bound(input_scale, reserve_amount, supply, false);

        // Check max supply
        if new_supply > max_supply {
            return Err("exactReserveIn: Exceeds maximum supply");
        }

        // Calculate actual tokens received
        Ok(new_supply - supply)
    }

    /*/// Calculate the number of tokens that need to be provided to receive a specific amount of reserve tokens
    ///
    /// # Arguments
    ///
    /// * `supply` - Current token supply
    /// * `input_scale` - The scaling factor for price calculations
    /// * `reserve_amount` - The amount of reserve tokens to receive
    ///
    /// # Returns
    ///
    /// The number of tokens required
    pub fn exact_reserve_out(
        supply: f64,
        input_scale: f64,
        reserve_amount: f64,
    ) -> Result<f64, &'static str> {
        // Calculate the new supply directly
        // Round down: user is paying (supply - new_supply),
        // so we want to minimize `new_supply`
        let new_supply =
            Math::get_sqrt_integral_left_bound(input_scale, reserve_amount, supply, false);

        if new_supply > supply {
            return Err("exactReserveOut: Insufficient supply");
        }

        // Calculate tokens to be provided
        Ok(supply - new_supply)
    }*/
}
