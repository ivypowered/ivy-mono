# ivy

This repository contains the C smart contract for Ivy, as well as a reusable Solana SDK, `ivy-lib`.

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

Also - the default build configuration is pinned to the Ivy mainnet. This is a good thing for deployment,
but it means that if you want to build and test your own local version, the SDK will throw an error trying to access
the nonexistent Ivy mainnet program address. To fix this and use your local keypair, delete `declare_id.txt`.
