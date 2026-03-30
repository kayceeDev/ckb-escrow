// ─────────────────────────────────────────────────────────────────────────────
// types.rs — Core data structures for the CKB escrow contract
// ─────────────────────────────────────────────────────────────────────────────
//
// RUST CONCEPT: `use` imports
// In Rust, you must explicitly import anything you want to use.
// `alloc` is a special crate that provides heap-allocated types (like Vec)
// in environments without the standard library — which is us, because this
// contract runs on a bare-metal RISC-V chip with no OS underneath it.
use alloc::vec::Vec;

// ─────────────────────────────────────────────────────────────────────────────
// EscrowState
// ─────────────────────────────────────────────────────────────────────────────
//
// RUST CONCEPT: Enums
// Rust enums are much more powerful than C enums. Each variant can hold data
// (we'll see that later with EscrowError). Here we use a simple "C-style"
// enum where each variant is just a named number.
//
// RUST CONCEPT: Attributes (#[...])
// Attributes are metadata attached to items. They change how the compiler
// treats something.
//
// `#[repr(u8)]` tells Rust: store this enum as a single byte in memory,
// with values starting at 0. We need this because we're reading and writing
// raw bytes from the CKB cell's data field — we need exact control over layout.
//
// `#[derive(...)]` auto-generates trait implementations:
//   - Debug:   lets us print values with {:?} in tests
//   - Clone:   lets us call .clone() to make a copy
//   - Copy:    lets Rust copy this value automatically (it's tiny — just 1 byte)
//   - PartialEq: lets us compare values with ==
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EscrowState {
    Funded = 0x00,    // Buyer has deposited funds. Waiting for seller.
    Delivered = 0x01, // Seller says goods/services were delivered.
    Completed = 0x02, // Buyer confirmed. Seller can claim payment.
    Disputed = 0x03,  // Either party raised a dispute.
    Resolved = 0x04,  // Arbitrator decided. Winner can claim payment.
    Refunded = 0x05,  // Deadline passed. Buyer got money back.
    Cancelled = 0x06, // Buyer cancelled before seller acted.
}

// RUST CONCEPT: impl blocks
// In Rust, data (struct/enum) and behavior (methods) are defined separately.
// An `impl` block adds methods to a type.
//
// Think of it like: `struct` defines what data a type holds,
// `impl` defines what a type can do.
impl EscrowState {
    // Convert a raw byte (from the cell's data field) into an EscrowState.
    //
    // RUST CONCEPT: Result<T, E>
    // Functions that can fail return `Result`. It has two variants:
    //   Ok(value)  — success, contains the value
    //   Err(error) — failure, contains the error
    //
    // The caller MUST handle both cases. Rust won't let you ignore a Result.
    // This eliminates a whole class of bugs where people forget to check errors.
    //
    // `Self` refers to the type we're implementing — EscrowState in this case.
    // It's shorthand so you don't have to repeat the type name everywhere.
    pub fn from_byte(b: u8) -> Result<Self, EscrowError> {
        // RUST CONCEPT: match
        // `match` is like switch/case but exhaustive — Rust forces you to
        // handle every possible value. The `_` arm is a wildcard catch-all.
        match b {
            0x00 => Ok(EscrowState::Funded),
            0x01 => Ok(EscrowState::Delivered),
            0x02 => Ok(EscrowState::Completed),
            0x03 => Ok(EscrowState::Disputed),
            0x04 => Ok(EscrowState::Resolved),
            0x05 => Ok(EscrowState::Refunded),
            0x06 => Ok(EscrowState::Cancelled),
            _ => Err(EscrowError::InvalidState(b)),
        }
    }

    // Check whether a transition from `self` to `next` is valid.
    //
    // RUST CONCEPT: &self
    // Methods take `self` as the first parameter. `&self` means we borrow
    // the value (read-only reference) — we don't consume or modify it.
    // `self` (no &) would consume it. `&mut self` would allow mutation.
    pub fn can_transition_to(&self, next: EscrowState) -> bool {
        // RUST CONCEPT: tuple patterns in match
        // You can match on multiple values at once by grouping them in a tuple.
        // `(*self, next)` dereferences self (since it's a &EscrowState reference)
        // and pairs it with `next` to match against both simultaneously.
        match (*self, next) {
            (EscrowState::Funded, EscrowState::Delivered) => true,
            (EscrowState::Funded, EscrowState::Refunded) => true, // + time check
            (EscrowState::Funded, EscrowState::Cancelled) => true,
            (EscrowState::Delivered, EscrowState::Completed) => true,
            (EscrowState::Delivered, EscrowState::Disputed) => true,
            (EscrowState::Disputed, EscrowState::Resolved) => true,
            // All other transitions are illegal
            _ => false,
        }
    }

    // Return who is authorized to trigger a given transition.
    // We return a `Signer` value rather than a raw hash so the
    // type script can look up the right hash from EscrowData.
    //
    // Panics on invalid transitions — but we always call
    // `can_transition_to` first, so this should never be reached
    // with a bad transition in practice.
    #[allow(dead_code)]
    pub fn required_signer(&self, next: EscrowState) -> Signer {
        match (*self, next) {
            (EscrowState::Funded, EscrowState::Delivered) => Signer::Seller,
            (EscrowState::Funded, EscrowState::Cancelled) => Signer::Buyer,
            (EscrowState::Funded, EscrowState::Refunded) => Signer::Buyer,
            (EscrowState::Delivered, EscrowState::Completed) => Signer::Buyer,
            (EscrowState::Delivered, EscrowState::Disputed) => Signer::AnyParty,
            (EscrowState::Disputed, EscrowState::Resolved) => Signer::Arbitrator,
            // This arm should never be reached if you call can_transition_to first
            _ => Signer::AnyParty,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Signer — who is authorized for a given action
// ─────────────────────────────────────────────────────────────────────────────
//
// This enum describes which party must be present (as a signing input cell)
// for a state transition to be valid.
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(dead_code)]
pub enum Signer {
    Buyer,
    Seller,
    Arbitrator,
    AnyParty, // Buyer OR seller (for raising a dispute)
}

// ─────────────────────────────────────────────────────────────────────────────
// EscrowError
// ─────────────────────────────────────────────────────────────────────────────
//
// RUST CONCEPT: Enum variants with data
// Unlike C-style enums, Rust enum variants can hold values.
// `InvalidState(u8)` carries the bad byte so callers know what was received.
// This is one of Rust's most powerful features — errors carry context.
#[derive(Debug)]
pub enum EscrowError {
    /// Cell data is shorter than the 115-byte minimum
    DataTooShort,
    /// The state byte didn't match any known EscrowState
    InvalidState(u8),
    /// The description length field points past the end of the data
    InvalidDescriptionLength,
    /// A field that should be immutable across state transitions was changed
    ImmutableFieldChanged,
    /// The state transition is not in the valid transition table
    InvalidTransition,
    /// The required signer's lock hash was not found in the transaction inputs
    UnauthorizedSigner,
    /// The money flow in the output cells is wrong
    InvalidMoneyFlow,
    /// Tried to claim a refund but the deadline hasn't passed yet
    #[allow(dead_code)]
    DeadlineNotReached,
}

impl EscrowError {
    // Map each error to the i8 return code that CKB expects.
    // CKB treats 0 as success and any non-zero value as failure.
    // Negative numbers are conventional for contract errors.
    pub fn code(&self) -> i8 {
        match self {
            EscrowError::DataTooShort => -101,
            EscrowError::InvalidState(invalid_state) => {
                let _ = invalid_state;
                -102
            }
            EscrowError::InvalidDescriptionLength => -103,
            EscrowError::ImmutableFieldChanged => -104,
            EscrowError::InvalidTransition => -105,
            EscrowError::UnauthorizedSigner => -106,
            EscrowError::InvalidMoneyFlow => -107,
            EscrowError::DeadlineNotReached => -108,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EscrowData
// ─────────────────────────────────────────────────────────────────────────────
//
// This struct mirrors the byte layout stored in the CKB cell's `data` field:
//
//   Offset  Size  Field
//   ──────────────────────────────────────────────────────────────────
//   0       32    buyer_lock_hash       (blake2b hash of buyer's lock script)
//   32      32    seller_lock_hash      (blake2b hash of seller's lock script)
//   64      32    arbitrator_lock_hash  (blake2b hash of arbitrator's lock script)
//   96      8     amount                (u64, big-endian, in shannons)
//   104     8     deadline              (u64, big-endian, unix ms timestamp)
//   112     1     state                 (u8, see EscrowState)
//   113     2     description_len       (u16, big-endian)
//   115     N     description           (UTF-8 bytes)
//   ──────────────────────────────────────────────────────────────────
//   Total minimum: 115 bytes
//
// RUST CONCEPT: Structs
// A struct is a named collection of fields. Unlike a class in OOP languages,
// it has no methods by default — behavior is added in a separate `impl` block.
//
// RUST CONCEPT: [u8; 32]
// This is a fixed-size array of 32 bytes. The size is known at compile time,
// so it lives on the stack (no heap allocation needed). Perfect for hashes.
#[derive(Debug, Clone)]
pub struct EscrowData {
    pub buyer_lock_hash: [u8; 32],
    pub seller_lock_hash: [u8; 32],
    pub arbitrator_lock_hash: [u8; 32],
    pub amount: u64,   // in shannons (1 CKB = 100_000_000 shannons)
    pub deadline: u64, // unix timestamp in milliseconds
    pub state: EscrowState,
    pub description: Vec<u8>, // arbitrary UTF-8 text, stored on heap
}

impl EscrowData {
    /// Minimum number of bytes required to hold an EscrowData with empty description.
    pub const MIN_SIZE: usize = 115;

    // ─────────────────────────────────────────────────────────────────────────
    // Parse raw bytes → EscrowData
    // ─────────────────────────────────────────────────────────────────────────
    //
    // RUST CONCEPT: &[u8] — byte slice
    // A slice is a view into a contiguous sequence of elements. `&[u8]` is
    // a borrowed reference to a sequence of bytes. We don't own the data —
    // we just read it. This avoids unnecessary copies.
    //
    // This is how we accept raw data from the CKB cell without allocating.
    pub fn from_slice(data: &[u8]) -> Result<Self, EscrowError> {
        if data.len() < Self::MIN_SIZE {
            return Err(EscrowError::DataTooShort);
        }

        // RUST CONCEPT: try_into()
        // Converts a slice (&[u8]) into a fixed-size array ([u8; 32]).
        // It returns a Result because the slice might be wrong length.
        // `.unwrap()` panics on Err — safe here because we already checked
        // the length. In more defensive code you'd propagate with `?`.
        let buyer_lock_hash: [u8; 32] = data[0..32].try_into().unwrap();
        let seller_lock_hash: [u8; 32] = data[32..64].try_into().unwrap();
        let arbitrator_lock_hash: [u8; 32] = data[64..96].try_into().unwrap();

        // RUST CONCEPT: u64::from_be_bytes
        // Interprets 8 bytes as a big-endian unsigned 64-bit integer.
        // Big-endian = most significant byte first. Standard in network protocols.
        let amount = u64::from_be_bytes(data[96..104].try_into().unwrap());
        let deadline = u64::from_be_bytes(data[104..112].try_into().unwrap());

        // RUST CONCEPT: the ? operator
        // If `from_byte` returns Err, the `?` immediately returns that Err
        // from *this* function. If it returns Ok, the value inside is
        // unwrapped and assigned to `state`. It's shorthand for:
        //   match from_byte(...) { Ok(v) => v, Err(e) => return Err(e) }
        let state = EscrowState::from_byte(data[112])?;

        let desc_len = u16::from_be_bytes(data[113..115].try_into().unwrap()) as usize;

        if data.len() < Self::MIN_SIZE + desc_len {
            return Err(EscrowError::InvalidDescriptionLength);
        }

        // `.to_vec()` copies the slice into a new heap-allocated Vec<u8>.
        let description = data[115..115 + desc_len].to_vec();

        Ok(Self {
            buyer_lock_hash,
            seller_lock_hash,
            arbitrator_lock_hash,
            amount,
            deadline,
            state,
            description,
        })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Serialize EscrowData → raw bytes
    // ─────────────────────────────────────────────────────────────────────────
    //
    // Needed when building the OUTPUT cell of a state transition transaction.
    // We create a new cell with the updated state and serialize the data here.
    pub fn to_bytes(&self) -> Vec<u8> {
        // RUST CONCEPT: Vec::new() and capacity hint
        // Vec is a heap-allocated growable array. `with_capacity` pre-allocates
        // space to avoid repeated re-allocations as we push data in.
        let desc_len = self.description.len();
        let mut bytes = Vec::with_capacity(Self::MIN_SIZE + desc_len);

        // RUST CONCEPT: extend_from_slice
        // Appends all bytes from a slice to the Vec. More efficient than
        // pushing bytes one by one.
        bytes.extend_from_slice(&self.buyer_lock_hash);
        bytes.extend_from_slice(&self.seller_lock_hash);
        bytes.extend_from_slice(&self.arbitrator_lock_hash);
        bytes.extend_from_slice(&self.amount.to_be_bytes());
        bytes.extend_from_slice(&self.deadline.to_be_bytes());

        // RUST CONCEPT: enum as integer
        // Because EscrowState is #[repr(u8)], casting with `as u8` gives
        // us the underlying byte value (0x00 for Funded, 0x01 for Delivered…)
        bytes.push(self.state as u8);

        bytes.extend_from_slice(&(desc_len as u16).to_be_bytes());
        bytes.extend_from_slice(&self.description);

        bytes
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Validate that immutable fields haven't changed between old and new data
    // ─────────────────────────────────────────────────────────────────────────
    //
    // When a state transition happens, only `state` (and sometimes `description`)
    // should change. The parties, amount, and deadline are locked in at creation.
    //
    // This method checks that the new cell's data is consistent with the old one.
    pub fn assert_immutable_fields_match(&self, new: &EscrowData) -> Result<(), EscrowError> {
        if self.buyer_lock_hash != new.buyer_lock_hash
            || self.seller_lock_hash != new.seller_lock_hash
            || self.arbitrator_lock_hash != new.arbitrator_lock_hash
            || self.amount != new.amount
            || self.deadline != new.deadline
        {
            return Err(EscrowError::ImmutableFieldChanged);
        }
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
//
// RUST CONCEPT: #[cfg(test)]
// This attribute means: only compile this code when running tests (`cargo test`).
// It won't be included in the final RISC-V binary, keeping it small.
//
// RUST CONCEPT: mod tests and #[test]
// Tests live in a module named `tests` by convention. Each test function
// is annotated with `#[test]`. Rust's test runner finds and executes them.
#[cfg(test)]
mod tests {
    // RUST CONCEPT: super::*
    // `super` refers to the parent module (types.rs itself).
    // `use super::*` imports everything from the parent — so we can use
    // EscrowData, EscrowState etc. without prefixing them.
    use super::*;

    // Helper: build a minimal valid 115-byte data blob with a given state byte
    fn make_data(state_byte: u8) -> Vec<u8> {
        let mut data = vec![0u8; 115];
        data[112] = state_byte; // state field
        // description_len at 113..115 stays 0x0000 = empty description
        data
    }

    #[test]
    fn test_parse_minimal_funded() {
        let data = make_data(0x00);
        let parsed = EscrowData::from_slice(&data).expect("should parse");
        assert_eq!(parsed.state, EscrowState::Funded);
        assert_eq!(parsed.amount, 0);
        assert_eq!(parsed.description.len(), 0);
    }

    #[test]
    fn test_parse_with_description() {
        let desc = b"5 kg of apples";
        let desc_len = desc.len() as u16;

        let mut data = vec![0u8; 115 + desc.len()];
        data[112] = 0x00; // Funded
        data[113..115].copy_from_slice(&desc_len.to_be_bytes());
        data[115..115 + desc.len()].copy_from_slice(desc);

        let parsed = EscrowData::from_slice(&data).expect("should parse");
        assert_eq!(parsed.description, desc);
    }

    #[test]
    fn test_roundtrip() {
        // Parse → serialize → parse again and check equality
        let desc = b"roundtrip test";
        let desc_len = desc.len() as u16;
        let mut data = vec![0u8; 115 + desc.len()];
        data[96..104].copy_from_slice(&1_000_000_000u64.to_be_bytes()); // amount
        data[104..112].copy_from_slice(&9_999_999_999u64.to_be_bytes()); // deadline
        data[112] = 0x01; // Delivered
        data[113..115].copy_from_slice(&desc_len.to_be_bytes());
        data[115..].copy_from_slice(desc);

        let original = EscrowData::from_slice(&data).expect("parse original");
        let reserialized = original.to_bytes();
        let reparsed = EscrowData::from_slice(&reserialized).expect("parse reserialized");

        assert_eq!(reparsed.amount, 1_000_000_000);
        assert_eq!(reparsed.deadline, 9_999_999_999);
        assert_eq!(reparsed.state, EscrowState::Delivered);
        assert_eq!(reparsed.description, desc);
    }

    #[test]
    fn test_data_too_short() {
        let data = vec![0u8; 50]; // too short
        let result = EscrowData::from_slice(&data);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_state_byte() {
        let data = make_data(0xFF); // no such state
        let result = EscrowData::from_slice(&data);
        assert!(result.is_err());
    }

    #[test]
    fn test_valid_transitions() {
        assert!(EscrowState::Funded.can_transition_to(EscrowState::Delivered));
        assert!(EscrowState::Funded.can_transition_to(EscrowState::Cancelled));
        assert!(EscrowState::Funded.can_transition_to(EscrowState::Refunded));
        assert!(EscrowState::Delivered.can_transition_to(EscrowState::Completed));
        assert!(EscrowState::Delivered.can_transition_to(EscrowState::Disputed));
        assert!(EscrowState::Disputed.can_transition_to(EscrowState::Resolved));
    }

    #[test]
    fn test_invalid_transitions() {
        // Can't skip states
        assert!(!EscrowState::Funded.can_transition_to(EscrowState::Completed));
        assert!(!EscrowState::Funded.can_transition_to(EscrowState::Resolved));
        assert!(!EscrowState::Delivered.can_transition_to(EscrowState::Funded));
        assert!(!EscrowState::Completed.can_transition_to(EscrowState::Disputed));
    }

    #[test]
    fn test_immutable_fields() {
        let data = make_data(0x00);
        let original = EscrowData::from_slice(&data).unwrap();

        // Same data — should pass
        let same = EscrowData::from_slice(&data).unwrap();
        assert!(original.assert_immutable_fields_match(&same).is_ok());

        // Different amount — should fail
        let mut tampered_data = data.clone();
        tampered_data[96..104].copy_from_slice(&999u64.to_be_bytes());
        let tampered = EscrowData::from_slice(&tampered_data).unwrap();
        assert!(original.assert_immutable_fields_match(&tampered).is_err());
    }
}
