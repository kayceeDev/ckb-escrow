# CKB Escrow Contract - Agent Guide

## Project Context

CKB Escrow is a decentralized escrow system for goods and services on Nervos CKB.

This repository contains the contract/protocol side of the project: Rust CKB scripts, script data parsing, contract tests, deployment helpers, and protocol documentation.

The frontend lives in a separate repository:

```text
/home/bodo/work/ckb/ckb-escrow-frontend
```

Keep the repositories separate. Do not move the frontend into this contract repository.

## Product We Are Building

The product is a standalone escrow app for known parties. It is not a marketplace, storefront, listing system, or reputation platform.

Primary v1 flow:

1. buyer creates and funds an escrow
2. seller marks goods or work as delivered
3. buyer releases funds or disputes
4. arbitrator resolves disputes when needed
5. buyer refunds after deadline when the contract allows it

Identity is wallet-first. There is no email/password registration in v1. Buyer, seller, and arbitrator are represented by CKB lock hashes and, when settlement is needed, full lock scripts.

## Repository Responsibilities

This repo is responsible for:

- CKB script behavior
- escrow data layout
- state transition validation
- lock/type script rules
- Rust unit tests
- ckb-testtool integration tests
- reproducible build/deployment notes
- protocol documentation

The frontend repo is responsible for:

- wallet connection
- network selection
- escrow discovery UX
- transaction building through SDK/adapters
- product screens
- studio/admin console

The contract remains the source of truth. Do not add UI-visible behavior unless the contract supports and enforces it.

## Key Paths

```text
contracts/escrow-lock/src/main.rs      # script entrypoint and validation flow
contracts/escrow-lock/src/types.rs     # escrow data types, parsing, state helpers
tests/src/tests.rs                     # ckb-testtool integration tests
scripts/                               # deployment/build helper scripts
docs/                                  # reports, deployment notes, learning docs
Cargo.toml                             # workspace manifest
```

## CKB Mental Model

CKB uses cells, not mutable contract storage.

An escrow is represented by a cell:

- `capacity`: CKB locked in the cell
- `lock`: who can spend the cell
- `type`: rules the cell must obey
- `data`: escrow state and participant information

Cells are immutable. Updating escrow state means consuming an old escrow cell and creating a new escrow cell with updated data.

Lock scripts answer: who is allowed to spend this cell?

Type scripts answer: is this state transition valid?

Keep access control and business logic separated unless there is a strong protocol reason not to.

## Escrow State Machine

Keep these states aligned across Rust, tests, SDK, frontend, and docs:

- `FUNDED`
- `DELIVERED`
- `COMPLETED`
- `DISPUTED`
- `RESOLVED`
- `REFUNDED`
- `CANCELLED`

Core transitions:

- buyer funds escrow
- seller marks delivered
- buyer completes and releases to seller
- buyer or seller disputes
- arbitrator resolves to buyer
- arbitrator resolves to seller
- buyer refunds after deadline when allowed
- buyer cancels before seller action when allowed

When changing a transition, update all related layers:

- Rust validation logic
- Rust unit tests
- integration tests
- TypeScript SDK types
- frontend CTA visibility
- studio operation controls
- documentation

## Data and Settlement Rules

Lock hash is enough for role identification and authorization checks.

Full lock script is needed when building payout outputs. Do not confuse identity with settlement destination.

For frontend compatibility, any contract/data layout change must be documented clearly enough for the SDK to serialize and parse it exactly.

## Testnet and Mainnet

The contract code is chain-agnostic, but deployments are network-specific.

Testnet and mainnet require separate:

- deployed script cells
- code hashes
- hash types
- cell deps
- RPC URLs
- indexer URLs
- address prefixes
- deployment profiles

Never treat a testnet deployment as mainnet-ready. Testnet is the default development target.

## Commands

Run focused contract checks when changing contract code:

```bash
cargo test -q -p escrow-lock
cargo test -q -p tests --no-run
```

If integration tests require a compiled binary, CKB toolchain, or local test setup that is unavailable, report the missing prerequisite clearly.

Do not hide failing tests or claim test coverage that was not run.

## Deployment Expectations

Deployment is not complete just because the contract builds.

A usable deployment needs:

- deployed script code cell
- deployment transaction hash
- script code hash
- hash type
- cell dep outpoint
- RPC/indexer configuration
- frontend deployment profile
- successful test transaction

Private keys, seed phrases, wallet exports, and deployer credentials must never be committed or pasted into chat.

## Documentation Standards

Weekly reports should be honest, readable, and scoped like the existing Nervos Builder Track reports.

Good reports include:

- overview
- repositories
- what was built
- key learnings
- current state
- next steps
- reflection
- screenshots when useful

Do not fabricate work. Do not falsify git history or backdate commits.

## Agent Operating Rules

Read before changing. Inspect the relevant files before editing.

Keep the user learning. This project is also for learning Rust, CKB internals, wallet flows, and frontend integration. When making meaningful changes, explain what changed, why it matters, and which CKB or Rust concept it touches.

Do not revert user changes unless explicitly asked.

If unexpected changes appear in files you are editing, stop and ask how to proceed.

Commit only when the user asks for a commit or the current workflow explicitly requires one. Do not amend commits unless explicitly requested.

Prefer small, verifiable changes over broad rewrites.

## Current Priorities

1. Harden the escrow contract and integration tests.
2. Keep testnet deployment reproducible.
3. Maintain a clear contract/frontend boundary.
4. Keep SDK and frontend behavior aligned with contract truth.
5. Support buyer, seller, and arbitrator flows end to end.
6. Preserve the studio route for protocol debugging.
