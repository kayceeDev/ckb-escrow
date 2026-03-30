#![cfg_attr(not(any(feature = "library", test)), no_std)]
#![cfg_attr(not(test), no_main)]

#[cfg(any(feature = "library", test))]
extern crate alloc;

mod types;

use alloc::vec::Vec;
use ckb_std::{
    ckb_constants::Source,
    ckb_types::prelude::Unpack,
    error::SysError,
    high_level::{
        load_cell_capacity, load_cell_data, load_cell_lock_hash, load_cell_type_hash, load_header,
        load_script_hash, load_witness_args,
    },
};
use types::{EscrowData, EscrowError, EscrowState, Signer};

#[cfg(not(any(feature = "library", test)))]
use ckb_std::{default_alloc, entry};

#[cfg(not(any(feature = "library", test)))]
entry!(program_entry);

#[cfg(not(any(feature = "library", test)))]
default_alloc!(16384, 1258306, 64);

const ERR_LOAD_SCRIPT_HASH: i8 = -1;
const ERR_LOAD_INPUT_LOCK_HASH: i8 = -2;
const ERR_MULTIPLE_INPUT_ESCROWS: i8 = -3;
const ERR_MULTIPLE_OUTPUT_ESCROWS: i8 = -4;
const ERR_INVALID_ESCROW_SHAPE: i8 = -5;
const ERR_LOAD_CELL_DATA: i8 = -6;
const ERR_LOAD_CELL_TYPE_HASH: i8 = -7;
const ERR_LOAD_WITNESS_ARGS: i8 = -8;
const ERR_INVALID_ACTION: i8 = -9;
const ERR_LOAD_HEADER: i8 = -10;
const ERR_LOAD_CELL_CAPACITY: i8 = -11;

// Witness input_type action codes:
// 0x01 = seller marks delivered
// 0x02 = buyer cancels before fulfillment
// 0x03 = buyer refunds after deadline
// 0x04 = buyer completes and pays seller
// 0x05 = buyer or seller raises dispute
// 0x06 = arbitrator resolves to buyer
// 0x07 = arbitrator resolves to seller
#[derive(Debug, Clone, Copy, PartialEq)]
enum EscrowAction {
    Deliver,
    Cancel,
    Refund,
    Complete,
    Dispute,
    ResolveToBuyer,
    ResolveToSeller,
}

impl EscrowAction {
    fn from_byte(byte: u8) -> Result<Self, i8> {
        match byte {
            0x01 => Ok(EscrowAction::Deliver),
            0x02 => Ok(EscrowAction::Cancel),
            0x03 => Ok(EscrowAction::Refund),
            0x04 => Ok(EscrowAction::Complete),
            0x05 => Ok(EscrowAction::Dispute),
            0x06 => Ok(EscrowAction::ResolveToBuyer),
            0x07 => Ok(EscrowAction::ResolveToSeller),
            _ => Err(ERR_INVALID_ACTION),
        }
    }
}

fn has_lock_hash(input_lock_hashes: &[[u8; 32]], expected: &[u8; 32]) -> bool {
    input_lock_hashes.iter().any(|hash| hash == expected)
}

fn signer_is_authorized(
    signer: Signer,
    escrow: &EscrowData,
    input_lock_hashes: &[[u8; 32]],
) -> bool {
    match signer {
        Signer::Buyer => has_lock_hash(input_lock_hashes, &escrow.buyer_lock_hash),
        Signer::Seller => has_lock_hash(input_lock_hashes, &escrow.seller_lock_hash),
        Signer::Arbitrator => has_lock_hash(input_lock_hashes, &escrow.arbitrator_lock_hash),
        Signer::AnyParty => {
            has_lock_hash(input_lock_hashes, &escrow.buyer_lock_hash)
                || has_lock_hash(input_lock_hashes, &escrow.seller_lock_hash)
        }
    }
}

fn validate_creation(
    new_escrow: &EscrowData,
    input_lock_hashes: &[[u8; 32]],
) -> Result<(), EscrowError> {
    if new_escrow.state != EscrowState::Funded {
        return Err(EscrowError::InvalidTransition);
    }

    if !signer_is_authorized(Signer::Buyer, new_escrow, input_lock_hashes) {
        return Err(EscrowError::UnauthorizedSigner);
    }

    Ok(())
}

fn validate_transition(
    old_escrow: &EscrowData,
    new_escrow: &EscrowData,
    old_capacity: u64,
    new_capacity: u64,
    input_lock_hashes: &[[u8; 32]],
    action: EscrowAction,
) -> Result<(), EscrowError> {
    old_escrow.assert_immutable_fields_match(new_escrow)?;

    if old_capacity != new_capacity {
        return Err(EscrowError::InvalidMoneyFlow);
    }

    match (old_escrow.state, new_escrow.state, action) {
        (EscrowState::Funded, EscrowState::Delivered, EscrowAction::Deliver) => {
            if !signer_is_authorized(Signer::Seller, old_escrow, input_lock_hashes) {
                return Err(EscrowError::UnauthorizedSigner);
            }
        }
        (EscrowState::Delivered, EscrowState::Disputed, EscrowAction::Dispute) => {
            if !signer_is_authorized(Signer::AnyParty, old_escrow, input_lock_hashes) {
                return Err(EscrowError::UnauthorizedSigner);
            }
        }
        _ => return Err(EscrowError::InvalidTransition),
    }

    Ok(())
}

fn validate_terminal_settlement(
    old_escrow: &EscrowData,
    input_lock_hashes: &[[u8; 32]],
    action: EscrowAction,
    recipient_net_gain: u64,
    current_timestamp: Option<u64>,
) -> Result<(), EscrowError> {
    match (old_escrow.state, action) {
        (EscrowState::Funded, EscrowAction::Cancel) => {
            if !signer_is_authorized(Signer::Buyer, old_escrow, input_lock_hashes) {
                return Err(EscrowError::UnauthorizedSigner);
            }
        }
        (EscrowState::Funded, EscrowAction::Refund) => {
            if !signer_is_authorized(Signer::Buyer, old_escrow, input_lock_hashes) {
                return Err(EscrowError::UnauthorizedSigner);
            }

            let now = current_timestamp.ok_or(EscrowError::DeadlineNotReached)?;
            if now < old_escrow.deadline {
                return Err(EscrowError::DeadlineNotReached);
            }
        }
        (EscrowState::Delivered, EscrowAction::Complete) => {
            if !signer_is_authorized(Signer::Buyer, old_escrow, input_lock_hashes) {
                return Err(EscrowError::UnauthorizedSigner);
            }
        }
        (EscrowState::Disputed, EscrowAction::ResolveToBuyer)
        | (EscrowState::Disputed, EscrowAction::ResolveToSeller) => {
            if !signer_is_authorized(Signer::Arbitrator, old_escrow, input_lock_hashes) {
                return Err(EscrowError::UnauthorizedSigner);
            }
        }
        _ => return Err(EscrowError::InvalidTransition),
    }

    if recipient_net_gain < old_escrow.amount {
        return Err(EscrowError::InvalidMoneyFlow);
    }

    Ok(())
}

fn collect_input_lock_hashes() -> Result<Vec<[u8; 32]>, i8> {
    let mut hashes = Vec::new();
    let mut index = 0;

    loop {
        match load_cell_lock_hash(index, Source::Input) {
            Ok(hash) => {
                hashes.push(hash);
                index += 1;
            }
            Err(SysError::IndexOutOfBound) => break,
            Err(_) => return Err(ERR_LOAD_INPUT_LOCK_HASH),
        }
    }

    Ok(hashes)
}

fn load_action_from_group_input() -> Result<EscrowAction, i8> {
    let witness_args =
        load_witness_args(0, Source::GroupInput).map_err(|_| ERR_LOAD_WITNESS_ARGS)?;
    let raw_action = witness_args
        .input_type()
        .to_opt()
        .ok_or(ERR_INVALID_ACTION)?
        .raw_data();

    if raw_action.len() != 1 {
        return Err(ERR_INVALID_ACTION);
    }

    EscrowAction::from_byte(raw_action[0])
}

fn load_reference_timestamp() -> Result<u64, i8> {
    let header = load_header(0, Source::HeaderDep).map_err(|_| ERR_LOAD_HEADER)?;
    Ok(header.raw().timestamp().unpack())
}

fn sum_output_capacity_for_lock_hash(expected: &[u8; 32]) -> Result<u64, i8> {
    let mut total = 0u64;
    let mut index = 0;

    loop {
        match load_cell_lock_hash(index, Source::Output) {
            Ok(lock_hash) => {
                if &lock_hash == expected {
                    let capacity = load_cell_capacity(index, Source::Output)
                        .map_err(|_| ERR_INVALID_ESCROW_SHAPE)?;
                    total = total
                        .checked_add(capacity)
                        .ok_or(ERR_INVALID_ESCROW_SHAPE)?;
                }
                index += 1;
            }
            Err(SysError::IndexOutOfBound) => break,
            Err(_) => return Err(ERR_INVALID_ESCROW_SHAPE),
        }
    }

    Ok(total)
}

fn sum_input_capacity_for_lock_hash(expected: &[u8; 32]) -> Result<u64, i8> {
    let mut total = 0u64;
    let mut index = 0;

    loop {
        match load_cell_lock_hash(index, Source::Input) {
            Ok(lock_hash) => {
                if &lock_hash == expected {
                    let capacity = load_cell_capacity(index, Source::Input)
                        .map_err(|_| ERR_LOAD_CELL_CAPACITY)?;
                    total = total.checked_add(capacity).ok_or(ERR_LOAD_CELL_CAPACITY)?;
                }
                index += 1;
            }
            Err(SysError::IndexOutOfBound) => break,
            Err(_) => return Err(ERR_LOAD_INPUT_LOCK_HASH),
        }
    }

    Ok(total)
}

fn load_cell_capacity_checked(index: usize, source: Source) -> Result<u64, i8> {
    load_cell_capacity(index, source).map_err(|_| ERR_LOAD_CELL_CAPACITY)
}

fn find_escrow_cell(source: Source, script_hash: &[u8; 32]) -> Result<(Option<usize>, usize), i8> {
    let mut first_match = None;
    let mut count = 0;
    let mut index = 0;

    loop {
        match load_cell_type_hash(index, source) {
            Ok(Some(type_hash)) => {
                if type_hash == *script_hash {
                    if first_match.is_none() {
                        first_match = Some(index);
                    }
                    count += 1;
                }
                index += 1;
            }
            Ok(None) => {
                index += 1;
            }
            Err(SysError::IndexOutOfBound) => break,
            Err(_) => return Err(ERR_LOAD_CELL_TYPE_HASH),
        }
    }

    Ok((first_match, count))
}

fn load_escrow_data(index: usize, source: Source) -> Result<EscrowData, i8> {
    let raw_data = load_cell_data(index, source).map_err(|_| ERR_LOAD_CELL_DATA)?;
    EscrowData::from_slice(&raw_data).map_err(|err| err.code())
}

pub fn program_entry() -> i8 {
    let script_hash = match load_script_hash() {
        Ok(hash) => hash,
        Err(_) => return ERR_LOAD_SCRIPT_HASH,
    };

    let input_lock_hashes = match collect_input_lock_hashes() {
        Ok(hashes) => hashes,
        Err(code) => return code,
    };

    let (input_index, input_count) = match find_escrow_cell(Source::Input, &script_hash) {
        Ok(result) => result,
        Err(code) => return code,
    };
    let (output_index, output_count) = match find_escrow_cell(Source::Output, &script_hash) {
        Ok(result) => result,
        Err(code) => return code,
    };

    if input_count > 1 {
        return ERR_MULTIPLE_INPUT_ESCROWS;
    }

    if output_count > 1 {
        return ERR_MULTIPLE_OUTPUT_ESCROWS;
    }

    match (input_index, output_index) {
        (None, Some(output_index)) => {
            let new_escrow = match load_escrow_data(output_index, Source::Output) {
                Ok(escrow) => escrow,
                Err(code) => return code,
            };
            validate_creation(&new_escrow, &input_lock_hashes)
                .map(|_| 0)
                .unwrap_or_else(|err| err.code())
        }
        (Some(input_index), Some(output_index)) => {
            let old_escrow = match load_escrow_data(input_index, Source::Input) {
                Ok(escrow) => escrow,
                Err(code) => return code,
            };
            let new_escrow = match load_escrow_data(output_index, Source::Output) {
                Ok(escrow) => escrow,
                Err(code) => return code,
            };
            let action = match load_action_from_group_input() {
                Ok(action) => action,
                Err(code) => return code,
            };
            let old_capacity = match load_cell_capacity_checked(input_index, Source::Input) {
                Ok(capacity) => capacity,
                Err(code) => return code,
            };
            let new_capacity = match load_cell_capacity_checked(output_index, Source::Output) {
                Ok(capacity) => capacity,
                Err(code) => return code,
            };

            validate_transition(
                &old_escrow,
                &new_escrow,
                old_capacity,
                new_capacity,
                &input_lock_hashes,
                action,
            )
            .map(|_| 0)
            .unwrap_or_else(|err| err.code())
        }
        (Some(input_index), None) => {
            let old_escrow = match load_escrow_data(input_index, Source::Input) {
                Ok(escrow) => escrow,
                Err(code) => return code,
            };
            let action = match load_action_from_group_input() {
                Ok(action) => action,
                Err(code) => return code,
            };

            let recipient_lock_hash = match (old_escrow.state, action) {
                (EscrowState::Funded, EscrowAction::Cancel)
                | (EscrowState::Funded, EscrowAction::Refund) => old_escrow.buyer_lock_hash,
                (EscrowState::Delivered, EscrowAction::Complete) => old_escrow.seller_lock_hash,
                (EscrowState::Disputed, EscrowAction::ResolveToBuyer) => old_escrow.buyer_lock_hash,
                (EscrowState::Disputed, EscrowAction::ResolveToSeller) => {
                    old_escrow.seller_lock_hash
                }
                _ => return EscrowError::InvalidTransition.code(),
            };

            let recipient_output_capacity =
                match sum_output_capacity_for_lock_hash(&recipient_lock_hash) {
                    Ok(amount) => amount,
                    Err(code) => return code,
                };
            let recipient_input_capacity =
                match sum_input_capacity_for_lock_hash(&recipient_lock_hash) {
                    Ok(amount) => amount,
                    Err(code) => return code,
                };
            let recipient_net_gain =
                recipient_output_capacity.saturating_sub(recipient_input_capacity);
            let current_timestamp = if action == EscrowAction::Refund {
                match load_reference_timestamp() {
                    Ok(timestamp) => Some(timestamp),
                    Err(code) => return code,
                }
            } else {
                None
            };

            validate_terminal_settlement(
                &old_escrow,
                &input_lock_hashes,
                action,
                recipient_net_gain,
                current_timestamp,
            )
            .map(|_| 0)
            .unwrap_or_else(|err| err.code())
        }
        _ => ERR_INVALID_ESCROW_SHAPE,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_hash(byte: u8) -> [u8; 32] {
        [byte; 32]
    }

    fn sample_escrow(state: EscrowState) -> EscrowData {
        EscrowData {
            buyer_lock_hash: sample_hash(0x11),
            seller_lock_hash: sample_hash(0x22),
            arbitrator_lock_hash: sample_hash(0x33),
            amount: 1_000,
            deadline: 1_700_000_000_000,
            state,
            description: b"website redesign".to_vec(),
        }
    }

    #[test]
    fn creation_requires_buyer_signature() {
        let escrow = sample_escrow(EscrowState::Funded);
        let input_lock_hashes = vec![sample_hash(0x22)];

        let result = validate_creation(&escrow, &input_lock_hashes);

        assert!(matches!(result, Err(EscrowError::UnauthorizedSigner)));
    }

    #[test]
    fn creation_accepts_buyer_signature() {
        let escrow = sample_escrow(EscrowState::Funded);
        let input_lock_hashes = vec![sample_hash(0x11)];

        let result = validate_creation(&escrow, &input_lock_hashes);

        assert!(result.is_ok());
    }

    #[test]
    fn creation_rejects_non_funded_state() {
        let escrow = sample_escrow(EscrowState::Delivered);
        let input_lock_hashes = vec![sample_hash(0x11)];

        let result = validate_creation(&escrow, &input_lock_hashes);

        assert!(matches!(result, Err(EscrowError::InvalidTransition)));
    }

    #[test]
    fn funded_to_delivered_requires_seller_and_deliver_action() {
        let old_escrow = sample_escrow(EscrowState::Funded);
        let mut new_escrow = old_escrow.clone();
        new_escrow.state = EscrowState::Delivered;

        let buyer_only = vec![sample_hash(0x11)];
        let seller_present = vec![sample_hash(0x22)];

        assert!(matches!(
            validate_transition(
                &old_escrow,
                &new_escrow,
                2_000,
                2_000,
                &buyer_only,
                EscrowAction::Deliver,
            ),
            Err(EscrowError::UnauthorizedSigner)
        ));
        assert!(
            validate_transition(
                &old_escrow,
                &new_escrow,
                2_000,
                2_000,
                &seller_present,
                EscrowAction::Deliver
            )
            .is_ok()
        );
    }

    #[test]
    fn transition_rejects_wrong_action() {
        let old_escrow = sample_escrow(EscrowState::Funded);
        let mut new_escrow = old_escrow.clone();
        new_escrow.state = EscrowState::Delivered;

        let result = validate_transition(
            &old_escrow,
            &new_escrow,
            2_000,
            2_000,
            &[sample_hash(0x22)],
            EscrowAction::Cancel,
        );

        assert!(matches!(result, Err(EscrowError::InvalidTransition)));
    }

    #[test]
    fn delivered_to_disputed_requires_buyer_or_seller_with_dispute_action() {
        let old_escrow = sample_escrow(EscrowState::Delivered);
        let mut new_escrow = old_escrow.clone();
        new_escrow.state = EscrowState::Disputed;

        let outsider = vec![sample_hash(0x44)];
        let buyer = vec![sample_hash(0x11)];
        let seller = vec![sample_hash(0x22)];

        assert!(matches!(
            validate_transition(
                &old_escrow,
                &new_escrow,
                2_000,
                2_000,
                &outsider,
                EscrowAction::Dispute,
            ),
            Err(EscrowError::UnauthorizedSigner)
        ));
        assert!(
            validate_transition(
                &old_escrow,
                &new_escrow,
                2_000,
                2_000,
                &buyer,
                EscrowAction::Dispute,
            )
            .is_ok()
        );
        assert!(
            validate_transition(
                &old_escrow,
                &new_escrow,
                2_000,
                2_000,
                &seller,
                EscrowAction::Dispute,
            )
            .is_ok()
        );
    }

    #[test]
    fn transition_rejects_capacity_change() {
        let old_escrow = sample_escrow(EscrowState::Funded);
        let mut new_escrow = old_escrow.clone();
        new_escrow.state = EscrowState::Delivered;

        let result = validate_transition(
            &old_escrow,
            &new_escrow,
            2_000,
            1_999,
            &[sample_hash(0x22)],
            EscrowAction::Deliver,
        );

        assert!(matches!(result, Err(EscrowError::InvalidMoneyFlow)));
    }

    #[test]
    fn funded_to_cancelled_pays_buyer_and_requires_buyer_signature() {
        let old_escrow = sample_escrow(EscrowState::Funded);
        let seller_only = vec![sample_hash(0x22)];
        let buyer_present = vec![sample_hash(0x11)];

        assert!(matches!(
            validate_terminal_settlement(
                &old_escrow,
                &seller_only,
                EscrowAction::Cancel,
                old_escrow.amount,
                None
            ),
            Err(EscrowError::UnauthorizedSigner)
        ));
        assert!(
            validate_terminal_settlement(
                &old_escrow,
                &buyer_present,
                EscrowAction::Cancel,
                old_escrow.amount,
                None
            )
            .is_ok()
        );
    }

    #[test]
    fn delivered_to_completed_pays_seller_and_requires_buyer_signature() {
        let old_escrow = sample_escrow(EscrowState::Delivered);
        let seller_only = vec![sample_hash(0x22)];
        let buyer_present = vec![sample_hash(0x11)];

        assert!(matches!(
            validate_terminal_settlement(
                &old_escrow,
                &seller_only,
                EscrowAction::Complete,
                old_escrow.amount,
                None
            ),
            Err(EscrowError::UnauthorizedSigner)
        ));
        assert!(
            validate_terminal_settlement(
                &old_escrow,
                &buyer_present,
                EscrowAction::Complete,
                old_escrow.amount,
                None
            )
            .is_ok()
        );
    }

    #[test]
    fn refund_requires_deadline_to_have_passed() {
        let old_escrow = sample_escrow(EscrowState::Funded);

        let result = validate_terminal_settlement(
            &old_escrow,
            &[sample_hash(0x11)],
            EscrowAction::Refund,
            old_escrow.amount,
            Some(old_escrow.deadline - 1),
        );

        assert!(matches!(result, Err(EscrowError::DeadlineNotReached)));
    }

    #[test]
    fn refund_succeeds_after_deadline() {
        let old_escrow = sample_escrow(EscrowState::Funded);

        let result = validate_terminal_settlement(
            &old_escrow,
            &[sample_hash(0x11)],
            EscrowAction::Refund,
            old_escrow.amount,
            Some(old_escrow.deadline),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn disputed_to_buyer_resolution_requires_arbitrator() {
        let old_escrow = sample_escrow(EscrowState::Disputed);

        assert!(matches!(
            validate_terminal_settlement(
                &old_escrow,
                &[sample_hash(0x11)],
                EscrowAction::ResolveToBuyer,
                old_escrow.amount,
                None
            ),
            Err(EscrowError::UnauthorizedSigner)
        ));
        assert!(
            validate_terminal_settlement(
                &old_escrow,
                &[sample_hash(0x33)],
                EscrowAction::ResolveToBuyer,
                old_escrow.amount,
                None
            )
            .is_ok()
        );
    }

    #[test]
    fn disputed_to_seller_resolution_requires_arbitrator() {
        let old_escrow = sample_escrow(EscrowState::Disputed);

        assert!(matches!(
            validate_terminal_settlement(
                &old_escrow,
                &[sample_hash(0x22)],
                EscrowAction::ResolveToSeller,
                old_escrow.amount,
                None
            ),
            Err(EscrowError::UnauthorizedSigner)
        ));
        assert!(
            validate_terminal_settlement(
                &old_escrow,
                &[sample_hash(0x33)],
                EscrowAction::ResolveToSeller,
                old_escrow.amount,
                None
            )
            .is_ok()
        );
    }

    #[test]
    fn terminal_settlement_rejects_insufficient_payout() {
        let funded = sample_escrow(EscrowState::Funded);
        let delivered = sample_escrow(EscrowState::Delivered);

        assert!(matches!(
            validate_terminal_settlement(
                &funded,
                &[sample_hash(0x11)],
                EscrowAction::Cancel,
                funded.amount - 1,
                None
            ),
            Err(EscrowError::InvalidMoneyFlow)
        ));
        assert!(matches!(
            validate_terminal_settlement(
                &delivered,
                &[sample_hash(0x11)],
                EscrowAction::Complete,
                delivered.amount - 1,
                None
            ),
            Err(EscrowError::InvalidMoneyFlow)
        ));
    }

    #[test]
    fn transition_rejects_immutable_field_changes() {
        let old_escrow = sample_escrow(EscrowState::Funded);
        let mut new_escrow = old_escrow.clone();
        new_escrow.state = EscrowState::Delivered;
        new_escrow.amount = 2_000;

        let result = validate_transition(
            &old_escrow,
            &new_escrow,
            2_000,
            2_000,
            &[sample_hash(0x22)],
            EscrowAction::Deliver,
        );

        assert!(matches!(result, Err(EscrowError::ImmutableFieldChanged)));
    }

    #[test]
    fn transition_rejects_not_yet_supported_paths() {
        let old_escrow = sample_escrow(EscrowState::Funded);
        let mut refunded = old_escrow.clone();
        refunded.state = EscrowState::Refunded;

        let result = validate_transition(
            &old_escrow,
            &refunded,
            2_000,
            2_000,
            &[sample_hash(0x11)],
            EscrowAction::Deliver,
        );

        assert!(matches!(result, Err(EscrowError::InvalidTransition)));
    }
}
