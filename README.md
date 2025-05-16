# ivy-mono

A monorepo for all code for the Ivy protocol, managed with Bazel.

## Prerequisites

To set up the development environment, install the following dependencies:

1. Bazel 8 or later
2. Node.js 20 or later
3. Python 3
4. Solana CLI (https://solana.com/docs/intro/installation)

## Building

Run `bazel build //...` to generate all targets.

## Development

Usually, you'll want to have these running somewhere:

```sh
# local validator w/ test games @ port 8899
bazel run //ivy-validator:dev
# local frontend @ port 3000
bazel run //ivy-frontend:dev
# local backend @ port 4000
bazel run //ivy-backend:dev
# local aggregator @ port 5000
bazel run //ivy-aggregator:dev
```
