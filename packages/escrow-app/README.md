# `@ckb-escrow/app`

Application-facing facade for the escrow system.

This package sits above:

- `@ckb-escrow/sdk`
- `@ckb-escrow/ccc-adapter`

Its job is to give frontend code a clean API such as:

- build escrow creation
- send escrow creation
- build deliver/dispute/refund/resolve flows
- send those flows through the active signer

This is the layer UI code should normally call first.
