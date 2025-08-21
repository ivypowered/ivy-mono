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
}
