use crate::{Loader, verify_and_dump_failed_tx};
use ckb_testtool::{
    builtin::ALWAYS_SUCCESS,
    ckb_types::{
        bytes::Bytes,
        core::{HeaderBuilder, TransactionBuilder},
        packed::*,
        prelude::*,
    },
    context::Context,
};

const MAX_CYCLES: u64 = 10_000_000;
const ESCROW_CAPACITY: u64 = 2_000;
const SIGNER_CAPACITY: u64 = 100;
const ESCROW_AMOUNT: u64 = 1_000;
const ESCROW_DEADLINE: u64 = 1_700_000_000_000;

fn deploy_escrow_contract(context: &mut Context) -> OutPoint {
    let loader = Loader::default();
    let contract_bin = loader.load_binary("escrow-lock");
    context.deploy_cell(contract_bin)
}

fn deploy_always_success(context: &mut Context) -> OutPoint {
    context.deploy_cell(ALWAYS_SUCCESS.clone())
}

fn build_party_lock(context: &mut Context, always_success: &OutPoint, tag: u8) -> Script {
    context
        .build_script(always_success, Bytes::from(vec![tag]))
        .expect("build always-success lock")
}

fn script_hash_array(script: &Script) -> [u8; 32] {
    script
        .calc_script_hash()
        .as_slice()
        .try_into()
        .expect("script hash length")
}

fn escrow_data(
    buyer_lock: &Script,
    seller_lock: &Script,
    arbitrator_lock: &Script,
    state: u8,
) -> Bytes {
    let mut data = Vec::with_capacity(115 + 16);
    data.extend_from_slice(&script_hash_array(buyer_lock));
    data.extend_from_slice(&script_hash_array(seller_lock));
    data.extend_from_slice(&script_hash_array(arbitrator_lock));
    data.extend_from_slice(&ESCROW_AMOUNT.to_be_bytes());
    data.extend_from_slice(&ESCROW_DEADLINE.to_be_bytes());
    data.push(state);

    let description = b"website redesign";
    data.extend_from_slice(&(description.len() as u16).to_be_bytes());
    data.extend_from_slice(description);
    data.into()
}

fn action_witness(action: u8) -> Bytes {
    WitnessArgs::new_builder()
        .input_type(Some(Bytes::from(vec![action])).pack())
        .build()
        .as_bytes()
}

fn empty_witness() -> Bytes {
    WitnessArgs::default().as_bytes()
}

fn create_input_cell(
    context: &mut Context,
    lock: Script,
    type_: Option<Script>,
    data: Bytes,
    capacity: u64,
) -> CellInput {
    let out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(capacity)
            .lock(lock)
            .type_(type_.pack())
            .build(),
        data,
    );
    CellInput::new_builder().previous_output(out_point).build()
}

fn build_escrow_output(lock: Script, type_script: Script, capacity: u64) -> CellOutput {
    CellOutput::new_builder()
        .capacity(capacity)
        .lock(lock)
        .type_(Some(type_script).pack())
        .build()
}

fn build_plain_output(lock: Script, capacity: u64) -> CellOutput {
    CellOutput::new_builder()
        .capacity(capacity)
        .lock(lock)
        .build()
}

fn insert_reference_header(context: &mut Context, timestamp: u64) -> Byte32 {
    let header = HeaderBuilder::default()
        .number(0u64)
        .timestamp(timestamp)
        .compact_target(1u32)
        .build();
    let hash = header.hash();
    context.insert_header(header);
    hash
}

#[test]
#[ignore = "requires built escrow-lock binary in build/<mode>/escrow-lock"]
fn test_escrow_creation_flow() {
    let mut context = Context::default();
    let escrow_contract = deploy_escrow_contract(&mut context);
    let always_success = deploy_always_success(&mut context);

    let buyer_lock = build_party_lock(&mut context, &always_success, 0x11);
    let seller_lock = build_party_lock(&mut context, &always_success, 0x22);
    let arbitrator_lock = build_party_lock(&mut context, &always_success, 0x33);
    let escrow_lock = build_party_lock(&mut context, &always_success, 0x44);
    let escrow_type = context
        .build_script(&escrow_contract, Bytes::new())
        .expect("build escrow type");

    let buyer_input = create_input_cell(
        &mut context,
        buyer_lock.clone(),
        None,
        Bytes::new(),
        ESCROW_CAPACITY + SIGNER_CAPACITY,
    );
    let escrow_output = build_escrow_output(escrow_lock, escrow_type, ESCROW_CAPACITY);

    let tx = TransactionBuilder::default()
        .input(buyer_input)
        .output(escrow_output)
        .output_data(escrow_data(&buyer_lock, &seller_lock, &arbitrator_lock, 0x00).pack())
        .witness(empty_witness().pack())
        .build();
    let tx = context.complete_tx(tx);

    verify_and_dump_failed_tx(&context, &tx, MAX_CYCLES).expect("creation should verify");
}

#[test]
#[ignore = "requires built escrow-lock binary in build/<mode>/escrow-lock"]
fn test_funded_to_delivered_flow() {
    let mut context = Context::default();
    let escrow_contract = deploy_escrow_contract(&mut context);
    let always_success = deploy_always_success(&mut context);

    let buyer_lock = build_party_lock(&mut context, &always_success, 0x11);
    let seller_lock = build_party_lock(&mut context, &always_success, 0x22);
    let arbitrator_lock = build_party_lock(&mut context, &always_success, 0x33);
    let escrow_lock = build_party_lock(&mut context, &always_success, 0x44);
    let escrow_type = context
        .build_script(&escrow_contract, Bytes::new())
        .expect("build escrow type");

    let escrow_input = create_input_cell(
        &mut context,
        escrow_lock.clone(),
        Some(escrow_type.clone()),
        escrow_data(&buyer_lock, &seller_lock, &arbitrator_lock, 0x00),
        ESCROW_CAPACITY,
    );
    let seller_input = create_input_cell(
        &mut context,
        seller_lock.clone(),
        None,
        Bytes::new(),
        SIGNER_CAPACITY,
    );
    let escrow_output = build_escrow_output(escrow_lock, escrow_type, ESCROW_CAPACITY);

    let tx = TransactionBuilder::default()
        .input(escrow_input)
        .input(seller_input)
        .output(escrow_output)
        .output_data(escrow_data(&buyer_lock, &seller_lock, &arbitrator_lock, 0x01).pack())
        .witness(action_witness(0x01).pack())
        .witness(empty_witness().pack())
        .build();
    let tx = context.complete_tx(tx);

    verify_and_dump_failed_tx(&context, &tx, MAX_CYCLES).expect("deliver should verify");
}

#[test]
#[ignore = "requires built escrow-lock binary in build/<mode>/escrow-lock"]
fn test_funded_to_refund_flow() {
    let mut context = Context::default();
    let escrow_contract = deploy_escrow_contract(&mut context);
    let always_success = deploy_always_success(&mut context);

    let buyer_lock = build_party_lock(&mut context, &always_success, 0x11);
    let seller_lock = build_party_lock(&mut context, &always_success, 0x22);
    let arbitrator_lock = build_party_lock(&mut context, &always_success, 0x33);
    let escrow_lock = build_party_lock(&mut context, &always_success, 0x44);
    let escrow_type = context
        .build_script(&escrow_contract, Bytes::new())
        .expect("build escrow type");

    let escrow_input = create_input_cell(
        &mut context,
        escrow_lock,
        Some(escrow_type),
        escrow_data(&buyer_lock, &seller_lock, &arbitrator_lock, 0x00),
        ESCROW_CAPACITY,
    );
    let buyer_input = create_input_cell(
        &mut context,
        buyer_lock.clone(),
        None,
        Bytes::new(),
        SIGNER_CAPACITY,
    );
    let buyer_output = build_plain_output(buyer_lock, ESCROW_CAPACITY + SIGNER_CAPACITY);
    let header_hash = insert_reference_header(&mut context, ESCROW_DEADLINE + 1);

    let tx = TransactionBuilder::default()
        .input(escrow_input)
        .input(buyer_input)
        .output(buyer_output)
        .output_data(Bytes::new().pack())
        .header_dep(header_hash)
        .witness(action_witness(0x03).pack())
        .witness(empty_witness().pack())
        .build();
    let tx = context.complete_tx(tx);

    verify_and_dump_failed_tx(&context, &tx, MAX_CYCLES).expect("refund should verify");
}

#[test]
#[ignore = "requires built escrow-lock binary in build/<mode>/escrow-lock"]
fn test_dispute_and_resolve_to_seller_flow() {
    let mut context = Context::default();
    let escrow_contract = deploy_escrow_contract(&mut context);
    let always_success = deploy_always_success(&mut context);

    let buyer_lock = build_party_lock(&mut context, &always_success, 0x11);
    let seller_lock = build_party_lock(&mut context, &always_success, 0x22);
    let arbitrator_lock = build_party_lock(&mut context, &always_success, 0x33);
    let escrow_lock = build_party_lock(&mut context, &always_success, 0x44);
    let escrow_type = context
        .build_script(&escrow_contract, Bytes::new())
        .expect("build escrow type");

    let dispute_input = create_input_cell(
        &mut context,
        escrow_lock.clone(),
        Some(escrow_type.clone()),
        escrow_data(&buyer_lock, &seller_lock, &arbitrator_lock, 0x01),
        ESCROW_CAPACITY,
    );
    let buyer_input = create_input_cell(
        &mut context,
        buyer_lock.clone(),
        None,
        Bytes::new(),
        SIGNER_CAPACITY,
    );
    let disputed_output = build_escrow_output(escrow_lock, escrow_type.clone(), ESCROW_CAPACITY);

    let dispute_tx = TransactionBuilder::default()
        .input(dispute_input)
        .input(buyer_input)
        .output(disputed_output)
        .output_data(escrow_data(&buyer_lock, &seller_lock, &arbitrator_lock, 0x03).pack())
        .witness(action_witness(0x05).pack())
        .witness(empty_witness().pack())
        .build();
    let dispute_tx = context.complete_tx(dispute_tx);

    verify_and_dump_failed_tx(&context, &dispute_tx, MAX_CYCLES).expect("dispute should verify");

    let disputed_lock = build_party_lock(&mut context, &always_success, 0x44);
    let disputed_input = create_input_cell(
        &mut context,
        disputed_lock,
        Some(escrow_type),
        escrow_data(&buyer_lock, &seller_lock, &arbitrator_lock, 0x03),
        ESCROW_CAPACITY,
    );
    let arbitrator_input = create_input_cell(
        &mut context,
        arbitrator_lock,
        None,
        Bytes::new(),
        SIGNER_CAPACITY,
    );
    let seller_output = build_plain_output(seller_lock, ESCROW_CAPACITY + SIGNER_CAPACITY);

    let resolve_tx = TransactionBuilder::default()
        .input(disputed_input)
        .input(arbitrator_input)
        .output(seller_output)
        .output_data(Bytes::new().pack())
        .witness(action_witness(0x07).pack())
        .witness(empty_witness().pack())
        .build();
    let resolve_tx = context.complete_tx(resolve_tx);

    verify_and_dump_failed_tx(&context, &resolve_tx, MAX_CYCLES).expect("resolution should verify");
}
