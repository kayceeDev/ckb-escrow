# CKB Escrow Contracts

Rust smart contracts and deployment tooling for the CKB escrow product.

The contract implements a standalone escrow flow for known buyer, seller, and arbitrator parties. The frontend lives in a separate repository and uses this contract metadata to build transactions.

## Contract Model

CKB uses cells instead of mutable contract storage. Updating escrow state means consuming the old escrow cell and creating a new escrow cell with updated data, or consuming it completely for terminal settlement.

The escrow cell contains:

- capacity: CKB locked in the cell
- lock script: escrow lock script
- type script: escrow state-machine script
- data: buyer/seller/arbitrator hashes, amount, deadline, state, description

The contract validates state transitions and terminal settlements.

## Roles

- Buyer: creates/funds escrow, cancels before delivery, refunds after deadline, releases funds after delivery, can dispute after delivery.
- Seller: marks escrow delivered, can dispute after delivery.
- Arbitrator: resolves disputed escrow to buyer or seller.

The contract identifies participants by lock hash. Each participant proves authorization by including a signed input cell whose lock hash matches the stored participant hash.

## State Machine

```text
Funded -> Delivered
Funded -> Cancelled
Funded -> Refunded
Delivered -> Completed
Delivered -> Disputed
Disputed -> Resolved
```

State bytes:

```text
0x00 Funded
0x01 Delivered
0x02 Completed
0x03 Disputed
0x04 Resolved
0x05 Refunded
0x06 Cancelled
```

Action witness bytes:

```text
0x01 Deliver
0x02 Cancel
0x03 Refund
0x04 Complete
0x05 Dispute
0x06 ResolveToBuyer
0x07 ResolveToSeller
```

## Repository Structure

```text
contracts/escrow-lock/  Escrow contract source
scripts/                Build/deploy helper scripts
deployment/             Local deployment artifacts; no secrets
tests/                  Integration tests with ckb-testtool
```

## Requirements

- Rust toolchain used by the project
- `riscv64imac-unknown-none-elf` Rust target
- Docker for reproducible builds
- Node.js/npm for local OffCKB CLI tooling
- clang/LLVM compatible with the CKB build flow

Install local Node tooling:

```bash
npm install
```

Useful Rust setup:

```bash
rustup target add riscv64imac-unknown-none-elf
rustup component add rustfmt clippy
```

## Build and Test

Unit tests:

```bash
cargo test -q -p escrow-lock
```

Compile integration tests:

```bash
cargo test -q -p tests --no-run
```

Build contract binary:

```bash
make build CONTRACT=escrow-lock
```

Run integration tests after binary exists:

```bash
cargo test -q -p tests -- --ignored
```

Lint/format checks:

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
```

Reproducible Docker build:

```bash
./scripts/reproducible_build_docker --no-clean
```

## Deployment With OffCKB

The repo pins `@offckb/cli` as a local dev dependency.

Check OffCKB:

```bash
npx --no-install @offckb/cli --help
npx --no-install @offckb/cli accounts
```

Build before deploying:

```bash
make build CONTRACT=escrow-lock
```

Deploy testnet:

```bash
export OFFCKB_TESTNET_PRIVKEY=0x...
npm run deploy:testnet
```

Deploy mainnet:

```bash
export OFFCKB_MAINNET_PRIVKEY=0x...
export CKB_ESCROW_MAINNET_CONFIRM=I_UNDERSTAND_MAINNET_RISK
npm run deploy:mainnet
```

Mainnet deployment is intentionally gated. Never put private keys in frontend env vars or committed files.

## Deployment Metadata Needed by Frontend

After deployment, copy the public metadata into the frontend environment variables:

```text
NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_CODE_HASH
NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_HASH_TYPE
NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_ARGS
NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEP_TX_HASH
NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEP_INDEX
NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_CODE_HASH
NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_HASH_TYPE
NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_ARGS
NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEFAULT_ARBITRATOR
```

Use the `MAINNET` prefix only after a real mainnet deployment:

```text
NEXT_PUBLIC_CKB_ESCROW_MAINNET_...
```

These `NEXT_PUBLIC_*` values are public script metadata, not secrets.

## Safety Notes

- Do not commit private keys.
- Do not commit funded wallet mnemonics.
- Keep mainnet deployment gated.
- Verify checksums before deployment when reproducibility matters.
- Treat testnet deployment metadata and mainnet deployment metadata separately.

## Related Repository

Frontend/product repo:

```text
https://github.com/kayceeDev/ckb-escrow-test-frontend
```
