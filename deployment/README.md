# Deployment Artifacts

This directory is for local deployment output generated while deploying the escrow contract to devnet, testnet, or mainnet.

Expected contents:

- OffCKB deployment records
- contract outpoints
- code hashes
- dep tx hash and dep index
- helper JSON copied from deployment tooling

Do not commit:

- private keys
- wallet mnemonics
- funded test/mainnet credentials
- secret RPC credentials

## Typical Flow

Build the contract:

```bash
make build CONTRACT=escrow-lock
```

Deploy to testnet:

```bash
export OFFCKB_TESTNET_PRIVKEY=0x...
npm run deploy:testnet
```

Deployment output is written under:

```text
deployment/testnet/
```

Mainnet output goes under:

```text
deployment/mainnet/
```

## Copying Metadata to Frontend

After deployment, copy public metadata into the frontend repo or Vercel environment variables:

```text
NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_CODE_HASH
NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_HASH_TYPE
NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_ARGS
NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEP_TX_HASH
NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEP_INDEX
NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_CODE_HASH
NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_HASH_TYPE
NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_ARGS
```

Also configure the platform arbitrator address:

```text
NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEFAULT_ARBITRATOR
```

These values are public deployment configuration. Private keys must stay out of frontend configuration.
