#![no_std]

use core::cmp::Ordering;

use ethnum::U256;
use fixed::types::U64F64;

#[cfg(not(test))]
#[no_mangle]
#[panic_handler]
#[inline(never)]
fn custom_panic(_: &core::panic::PanicInfo<'_>) -> ! {
    // this should never be called
    loop {}
}

#[cfg(target_os = "solana")]
extern "C" {
    fn sol_panic_(file: *const u8, file_len: u64, line: u64, zero: u64);
    fn sol_log_(str: *const u8, len: u64);
}

#[cfg(target_os = "solana")]
fn require(condition: bool, msg: &str) {
    if condition {
        return;
    }
    let file = "ivy-r128/lib.rs";
    unsafe {
        sol_log_(msg.as_ptr(), msg.len() as u64);
        sol_panic_(file.as_ptr(), file.len() as u64, 1, 0);
    }
}

#[cfg(not(target_os = "solana"))]
fn require(condition: bool, _: &str) {
    if condition {
        return;
    }
    // do nothing
    loop {}
}

/// Calculates the binary logarithm (log base 2) of a number using binary search approach.
///
/// This implementation requires exactly 8 iterations for U256 input.
///
/// # Arguments
///
/// * `n` - The U256 input value
///
/// # Returns
///
/// The floor of log2(n)
fn u256_log2(n: U256) -> u8 {
    let mut out = 0;
    let mut n = n;

    // Exactly 8 iterations (for U256)
    for s in [128, 64, 32, 16, 8, 4, 2, 1] {
        if n >= U256::new(1) << s {
            n >>= s;
            out |= s;
        }
    }

    out
}

/// Calculates the cube root of a U256 number.
///
/// Uses an optimized algorithm that combines a good initial estimate based on
/// binary logarithm with Newton-Raphson iterations.
/// The initial estimate is set to 2^(log2(n)/3 + 1), then refined iteratively.
///
/// This function cannot cause an arithmetic overflow.
///
/// # Arguments
///
/// * `x` - The U256 input value to find the cube root of.
///
/// # Returns
///
/// The cube root of x as U256, rounded down
fn u256_cbrt(x: U256) -> u128 {
    // Handle edge cases cheaply
    if *x.high() == 0 && *x.low() <= 1 {
        return *x.low();
    }

    // Initial estimate: 2^(log2(n) / 3 + 1)
    // Max value: 2^86
    let mut r = 1u128 << ((u256_log2(x) / 3) + 1);

    // Newton-Raphson iterations
    // r_new = (2/3)r + (1/3)(x/(r ** 2))
    loop {
        // `r` as a u256
        let r_256 = U256::new(r);

        // Newton's update
        let r_new = ((r << 1) + *(x / (r_256 * r_256)).low()) / 3;

        // Check convergence
        if r_new >= r {
            break;
        }

        // Set `r` for the next iteration
        r = r_new;
    }

    return r;
}

fn unwrap<T>(t: Option<T>, msg: &str) -> T {
    match t {
        Some(v) => v,
        None => {
            require(false, msg);
            loop {}
        }
    }
}

/// An unsigned binary fixed-point Q64.64 number
#[repr(C)]
#[derive(Clone, Copy)]
pub struct R128 {
    pub lo: u64,
    pub hi: u64,
}

impl From<U64F64> for R128 {
    fn from(value: U64F64) -> Self {
        let v = value.to_bits();
        Self {
            lo: (v & 0xFF_FF_FF_FF_FF_FF_FF_FF) as u64,
            hi: (v >> 64) as u64,
        }
    }
}

impl From<R128> for U64F64 {
    fn from(value: R128) -> Self {
        let bits = (value.hi as u128) << 64 | (value.lo as u128);
        U64F64::from_bits(bits)
    }
}

/// Creates a new r128 from the provided u64.
#[no_mangle]
pub extern "C" fn r128_from_u64_internal(dst: *mut R128, x: u64) {
    let result = R128::from(U64F64::from_num(x));
    unsafe {
        *dst = result;
    }
}

/// Creates a new r128 equaling `num / den`.
#[no_mangle]
pub extern "C" fn r128_from_frac_internal(dst: *mut R128, num: u64, den: u64) {
    let result = R128::from(unwrap(
        U64F64::from_num(num).checked_div_int(den as u128),
        "Error: divide by zero in r128_from_frac",
    ));
    unsafe {
        *dst = result;
    }
}

/// Creates a new r128 from the provided token amount and decimals.
#[no_mangle]
pub extern "C" fn r128_from_token_amount_internal(dst: *mut R128, amount: u64, decimals: u8) {
    require(
        decimals < 18,
        "Error: max decimals reached in r128_from_token_amount",
    );
    // safe: 10**18 < 2**64
    let result = R128::from(unwrap(
        U64F64::from_num(amount).checked_div_int(10u64.pow(decimals as u32) as u128),
        "Error: overflow in r128_from_token_amount",
    ));
    unsafe {
        *dst = result;
    }
}

/// Converts the given r128 into a token amount given the decimals,
/// truncating the decimal portion.
#[no_mangle]
pub extern "C" fn r128_to_token_amount_internal(x: *const R128, decimals: u8) -> u64 {
    require(
        decimals < 18,
        "Error: max decimals reached in r128_to_token_amount",
    );
    let x_val = unsafe { *x };
    // safe: 10**18 < 2**64
    unwrap(
        U64F64::from(x_val).checked_mul_int(10u64.pow(decimals as u32) as u128),
        "Error: divide by zero in r128_to_token_amount",
    )
    .to_num()
}

/// Compares two r128s, `a` and `b`.
/// - If `a < b`, returns `-1`.
/// - If `a == b`, returns `0`.
/// - If `a > b`, returns `1`.
#[no_mangle]
pub extern "C" fn r128_cmp_internal(a: *const R128, b: *const R128) -> i8 {
    let a_val = unsafe { *a };
    let b_val = unsafe { *b };
    match U64F64::from(a_val).cmp(&U64F64::from(b_val)) {
        Ordering::Less => -1,
        Ordering::Equal => 0,
        Ordering::Greater => 1,
    }
}

/// Tests if the r128 is zero.
#[no_mangle]
pub extern "C" fn r128_is_zero_internal(x: *const R128) -> bool {
    let x_val = unsafe { *x };
    U64F64::from(x_val).is_zero()
}

/// Adds two r128s.
#[no_mangle]
pub extern "C" fn r128_add_internal(dst: *mut R128, a: *const R128, b: *const R128) {
    let a_val = unsafe { *a };
    let b_val = unsafe { *b };
    let result = R128::from(unwrap(
        U64F64::from(a_val).checked_add(U64F64::from(b_val)),
        "Error: overflow in f128_add",
    ));
    unsafe {
        *dst = result;
    }
}

/// Subtracts two r128s.
#[no_mangle]
pub extern "C" fn r128_sub_internal(dst: *mut R128, a: *const R128, b: *const R128) {
    let a_val = unsafe { *a };
    let b_val = unsafe { *b };
    let result = R128::from(unwrap(
        U64F64::from(a_val).checked_sub(U64F64::from(b_val)),
        "Error: underflow in f128_sub",
    ));
    unsafe {
        *dst = result;
    }
}

/// Multiplies two r128s.
#[no_mangle]
pub extern "C" fn r128_mul_internal(dst: *mut R128, a: *const R128, b: *const R128) {
    let a_val = unsafe { *a };
    let b_val = unsafe { *b };
    let result = R128::from(unwrap(
        U64F64::from(a_val).checked_mul(U64F64::from(b_val)),
        "Error: overflow in f128_mul",
    ));
    unsafe {
        *dst = result;
    }
}

/// Divides two r128s, rounding towards zero.
#[no_mangle]
pub extern "C" fn r128_div_internal(dst: *mut R128, a: *const R128, b: *const R128) {
    let a_val = unsafe { *a };
    let b_val = unsafe { *b };
    let b_fixed = U64F64::from(b_val);
    require(!b_fixed.is_zero(), "Error: division by zero in f128_div");

    let result = R128::from(unwrap(
        U64F64::from(a_val).checked_div(b_fixed),
        "Error: overflow in f128_div",
    ));
    unsafe {
        *dst = result;
    }
}

/// Divides two r128s, rounding towards infinity.
#[no_mangle]
pub extern "C" fn r128_div_ceil_internal(dst: *mut R128, a: *const R128, b: *const R128) {
    let a_val = unsafe { *a };
    let b_val = unsafe { *b };
    let a_fixed = U64F64::from(a_val);
    let b_fixed = U64F64::from(b_val);
    require(
        !b_fixed.is_zero(),
        "Error: division by zero in f128_div_ceil",
    );

    let quotient = unwrap(
        a_fixed.checked_div(b_fixed),
        "Error: overflow in f128_div_ceil",
    );

    let a_estimate = unwrap(
        quotient.checked_mul(b_fixed),
        "Error: overflow in f128_div_ceil",
    );
    let result = if a_estimate < a_fixed {
        // quotient is less than true value
        unwrap(
            quotient.checked_add(U64F64::from_bits(1)),
            "Error: overflow in f128_div_ceil",
        )
    } else {
        // quotient is equal to true value
        quotient
    };
    unsafe {
        *dst = R128::from(result);
    }
}

/// Takes the square root of a r128, rounding towards zero.
#[no_mangle]
pub extern "C" fn r128_sqrt_internal(dst: *mut R128, x: *const R128) {
    let x_val = unsafe { *x };
    let result = R128::from(unwrap(
        U64F64::from(x_val).checked_sqrt(),
        "Error: overflow in r128_sqrt",
    ));
    unsafe {
        *dst = result;
    }
}

/// Takes the square root of a r128, rounding towards infinity.
#[no_mangle]
pub extern "C" fn r128_sqrt_ceil_internal(dst: *mut R128, x: *const R128) {
    let x_val = unsafe { *x };
    let x_fixed = U64F64::from(x_val);
    let x_sqrt = unwrap(x_fixed.checked_sqrt(), "Error: overflow in r128_sqrt");
    let x_estimate = unwrap(x_sqrt.checked_mul(x_sqrt), "Error: overflow in r128_sqrt");
    let result = if x_estimate < x_fixed {
        // x_sqrt is less than true value
        unwrap(
            x_sqrt.checked_add(U64F64::from_bits(1)),
            "Error: overflow in r128_sqrt_ceil",
        )
    } else {
        // x_sqrt is equal to true value
        x_sqrt
    };
    unsafe {
        *dst = R128::from(result);
    }
}

/// Takes the cubed root of a r128, rounding towards zero.
#[no_mangle]
#[inline(never)]
pub extern "C" fn r128_cbrt_internal(dst: *mut R128, x: *const R128) {
    let x_val = unsafe { *x };
    let x_fixed = U64F64::from(x_val);
    let x_256 = U256::from(x_fixed.to_bits());
    // cbrt(x * 2^64 * C) = cbrt(x) * 2^64
    // C = 2^128, since cbrt(2^192) = 2^64
    let r_128 = u256_cbrt(x_256 << 128);
    let r_fixed = U64F64::from_bits(r_128);
    unsafe {
        *dst = R128::from(r_fixed);
    }
}

/// Takes the cubed root of a r128, rounding towards infinity.
#[no_mangle]
pub extern "C" fn r128_cbrt_ceil_internal(dst: *mut R128, x: *const R128) {
    let x_val = unsafe { *x };

    // We'll use a temporary R128 to store the intermediate result
    let mut temp_r = R128 { lo: 0, hi: 0 };
    r128_cbrt_internal(&mut temp_r, x);

    let r = U64F64::from(temp_r);
    let rrr = unwrap(
        r.checked_mul(r).and_then(|rr| rr.checked_mul(r)),
        "Error: overflow in r128_cbrt_ceil",
    );
    let result = if rrr < U64F64::from(x_val) {
        // r is less than true value
        unwrap(
            r.checked_add(U64F64::from_bits(1)),
            "Error: overflow in r128_cbrt_ceil",
        )
    } else {
        // r is equal to true value
        r
    };
    unsafe {
        *dst = R128::from(result);
    }
}
