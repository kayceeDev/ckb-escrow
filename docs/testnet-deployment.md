# Deployment Guide

## What is ready

- Hardened escrow contract logic
- Release RISC-V binary can be built locally
- OffCKB CLI is usable via `npx`
- The contract is network-agnostic; deployment profiles are network-specific

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

3. A funded CKB private key for the target network

The deployment command needs a private key with enough capacity to create the
code cell and pay fees.

For testnet, export it only into your local shell:

```bash
export OFFCKB_TESTNET_PRIVKEY=0x...
```

For mainnet, use a separate key and only deploy after a production readiness
review:

```bash
export OFFCKB_MAINNET_PRIVKEY=0x...
export CKB_ESCROW_NETWORK=mainnet
export CKB_ESCROW_MAINNET_CONFIRM=I_UNDERSTAND_MAINNET_RISK
```

## Deploy with OffCKB

Testnet is the default:

```bash
cd /home/ghost/work/ckb-escrow
./scripts/deploy_offckb.sh
```

Mainnet must be requested explicitly:

```bash
cd /home/ghost/work/ckb-escrow
CKB_ESCROW_NETWORK=mainnet \
CKB_ESCROW_MAINNET_CONFIRM=I_UNDERSTAND_MAINNET_RISK \
./scripts/deploy_offckb.sh
```

This writes deployment records into the target network directory:

```text
deployment/testnet/
deployment/mainnet/
```

## What to capture after deployment

From the deployment output/record, capture the escrow script deployment values:

- code hash
- hash type
- cell dep tx hash
- cell dep index

These are the values the frontend admin console needs. Keep testnet and
mainnet values separate. A testnet deployment profile must not be reused on
mainnet.

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

1. Connect a funded CKB wallet for the same network as the deployment profile.
2. Use the Create screen to create a real funded escrow.
3. Use Overview -> Fetch Escrows to discover it.
4. Load it into Detail / Operate.
5. Test these flows:
   - `Funded -> Delivered`
   - `Delivered -> Disputed`
   - `Disputed -> ResolveToSeller`
   - `Funded -> Refund` after deadline

## Notes

- The Studio and product UI are network-aware, but testnet should remain the
  default validation environment.
- Mainnet should not be treated as production-ready until settlement paths,
  deployment metadata, and UI safety states have been verified separately.
- The integration tests in Rust are scaffolded, but live testnet verification
  is still important.
