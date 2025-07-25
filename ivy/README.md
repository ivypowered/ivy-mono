# ivy

This repository contains the C smart contract for Ivy.

## Requirements

```sh
# Install Anchor (+ Solang)
curl --proto '=https' --tlsv1.2 -sSfL https://raw.githubusercontent.com/solana-developers/solana-install/main/install.sh | bash
```

## Building

```sh
# Build the program
bazel build //ivy:build
```

## Notes

If you're developing this project locally and run into IDE errors, it might help to create a `.clangd`:

```sh
CompileFlags:
  Add:
    - "-I/home/<your username>/.local/share/solana/install/active_release/bin/sdk/sbf/c/inc"
    - "-Iinclude"
```
