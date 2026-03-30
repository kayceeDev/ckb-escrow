# `@ckb-escrow/sdk`

Protocol SDK for the CKB escrow contract in this repository.

This package is designed to sit on top of CCC rather than replace it.

Responsibilities:

- define escrow domain types
- encode and decode escrow cell data
- encode and decode witness action payloads
- validate legal state and action combinations
- produce transaction plans that a CCC adapter or frontend can execute

Non-responsibilities:

- wallet connection
- RPC transport
- raw CKB signing
- chain indexing

Those belong in CCC and the application layer around it.
