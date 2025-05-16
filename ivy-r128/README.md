# ivy-r128

ivy-r128 is a fixed-point math library for unsigned Q64.64 128-bit integers for Solana, written in Rust.

## Headers

eBPF (and by extension SBF) has no defined ABI
for structs greater than 64 bits in value -
see https://www.kernel.org/doc/html/v5.17/bpf/instruction-set.html.

So, the directly exported functions have the suffix `_internal`
and take pointers to `r128` structs. Then, we parse the
`cbindgen`-generated C headers and generate static functions
without the suffix that take `r128` arguments and return
`r128` results!
