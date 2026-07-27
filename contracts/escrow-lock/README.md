# escrow-lock

Escrow state-machine script for the CKB escrow product.

Despite the crate name, this script primarily enforces escrow state transitions and settlement rules for an escrow cell. It is compiled to a RISC-V binary and executed by CKB VM.

## Responsibilities

The script validates:

- escrow creation starts in `Funded`
- valid state transitions
- buyer/seller/arbitrator authorization by lock hash
- immutable escrow fields across non-terminal transitions
- deadline-aware refund behavior
- terminal settlement capacity to the expected recipient

The frontend and SDK build transactions; this script decides whether the transaction is valid on chain.

## Cell Data Layout

Escrow cell data is a strict byte layout:

```text
Offset  Size  Field
0       32    buyer_lock_hash
32      32    seller_lock_hash
64      32    arbitrator_lock_hash
96      8     amount, u64 big-endian shannons
104     8     deadline, u64 big-endian unix milliseconds
112     1     state
113     2     description length, u16 big-endian
115     N     description bytes
```

Minimum size: 115 bytes.

## States

```text
0x00 Funded
0x01 Delivered
0x02 Completed
0x03 Disputed
0x04 Resolved
0x05 Refunded
0x06 Cancelled
```

## Actions

The action is read from witness `input_type`:

```text
0x01 Deliver
0x02 Cancel
0x03 Refund
0x04 Complete
0x05 Dispute
0x06 ResolveToBuyer
0x07 ResolveToSeller
```

## Valid Transitions

```text
Funded -> Delivered      seller signs
Funded -> Cancelled      buyer signs
Funded -> Refunded       buyer signs and deadline passed
Delivered -> Completed   buyer signs
Delivered -> Disputed    buyer or seller signs
Disputed -> Resolved     arbitrator signs
```

Terminal actions consume the escrow cell instead of producing another escrow cell:

- Cancelled
- Refunded
- Completed
- Resolved

## Authorization Model

The contract does not verify secp256k1 signatures itself. Instead, it checks whether an input cell exists with the expected participant lock hash. That input cell's own lock script must already have verified the participant signature.

This keeps the escrow script wallet-agnostic and lets participants use different CKB lock types.

## Refund Time Check

Refund requires a header dependency. The script reads the referenced header timestamp and compares it with the escrow deadline.

If the referenced chain timestamp is earlier than the deadline, refund fails with `DeadlineNotReached`.

## Testing

Unit tests live near the data/state logic. Integration tests live in the workspace `tests` crate.

Useful commands:

```bash
cargo test -q -p escrow-lock
make build CONTRACT=escrow-lock
cargo test -q -p tests -- --ignored
```

## Notes for Frontend Integration

The frontend must provide:

- current escrow outpoint for active actions
- action witness byte
- participant input proving the required signer
- recipient lock script for terminal payouts when needed
- header dep for refund

Closed escrows should be loaded from indexer history, because the live escrow cell is consumed.
