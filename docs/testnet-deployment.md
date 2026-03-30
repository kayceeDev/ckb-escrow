# Testnet Deployment Guide

## What is ready

- Hardened escrow contract logic
- Release RISC-V binary can be built locally
- OffCKB CLI is usable via `npx`

## Prerequisites

1. Build toolchain installed
   - `clang-18`
   - `gcc-riscv64-unknown-elf`
   - `binutils-riscv64-unknown-elf`

2. Built release contract

```bash
cd /home/ghost/work/ckb-escrow
make build CONTRACT=escrow-lock
```

3. A funded CKB testnet private key

The deployment command needs a private key with enough capacity to create the
code cell and pay fees.

Export it only into your local shell:

```bash
export OFFCKB_TESTNET_PRIVKEY=0x...
```

## Deploy with OffCKB

```bash
cd /home/ghost/work/ckb-escrow
./scripts/deploy_testnet_offckb.sh
```

This writes deployment records into:

```text
deployment/testnet/
```

## What to capture after deployment

From the deployment output/record, capture the escrow script deployment values:

- code hash
- hash type
- cell dep tx hash
- cell dep index

These are the values the frontend admin console needs.

## Frontend wiring

In the separate frontend repo:

```bash
cd /home/ghost/work/ckb-escrow-frontend
npm run dev --workspace @ckb-escrow/frontend
```

Then in the admin console:

1. open the deployment section
2. paste:
   - type script code hash
   - hash type
   - dep tx hash
   - dep index
3. save a deployment profile

## How to test after deployment

1. Connect a funded CKB testnet wallet.
2. Use the Create screen to create a real funded escrow.
3. Use Overview -> Fetch Escrows to discover it.
4. Load it into Detail / Operate.
5. Test these flows:
   - `Funded -> Delivered`
   - `Delivered -> Disputed`
   - `Disputed -> ResolveToSeller`
   - `Funded -> Refund` after deadline

## Notes

- The current frontend is still an admin/protocol console, not the final
  product UX.
- The integration tests in Rust are scaffolded, but live testnet verification
  is still important.
