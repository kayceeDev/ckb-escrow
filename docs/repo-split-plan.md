# Repo Split Plan

## Goal

Move the frontend into a separate repository without breaking the current
monorepo while the protocol is still evolving.

## Recommended boundary

Keep this repository as the source of truth for:

- Rust contract
- Rust tests
- deployment artifacts and scripts
- shared TypeScript packages:
  - `@ckb-escrow/sdk`
  - `@ckb-escrow/ccc-adapter`
  - `@ckb-escrow/app`

Move into a separate repository:

- `@ckb-escrow/frontend`

## Why this order

The frontend is the easiest thing to separate first because:

- it already depends on clear package boundaries
- the contract should remain close to its tests and deployment workflow
- the protocol packages are still changing together with the contract

## Split workflow

1. Build the shared packages in this repo.
2. Pack `sdk`, `ccc-adapter`, and `app` into tarballs.
3. Export the frontend package into a standalone folder.
4. Rewrite the frontend package dependencies to use vendored tarballs.
5. Initialize the standalone folder as a new repository.

## Helper scripts

This repository now includes:

- `npm run pack:shared`
  Creates tarballs for the shared TypeScript packages under `artifacts/npm/`
- `npm run export:frontend-repo`
  Builds the shared packages, packs them, and exports a standalone frontend
  folder under `artifacts/frontend-repo/`

## After export

Inside the exported frontend folder:

1. run `npm install`
2. run `npm run typecheck`
3. run `npm run build`
4. create a fresh git repository there

## Longer-term option

Once the protocol stabilizes, the shared TypeScript packages can also be moved
to a separate repository or published to a package registry. Until then, keeping
them near the contract reduces coordination overhead.
