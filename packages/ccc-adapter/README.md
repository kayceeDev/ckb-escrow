# `@ckb-escrow/ccc-adapter`

CCC integration layer for the escrow protocol SDK.

This package is responsible for:

- turning escrow protocol plans into CCC transactions
- attaching deployment metadata such as cell deps
- providing helpers for fee completion with CCC signers

It deliberately depends on `@ckb-escrow/sdk` for protocol meaning instead of
re-encoding escrow rules itself.
