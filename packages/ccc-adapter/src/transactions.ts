import * as ccc from "@ckb-ccc/ccc";
import {
  createEscrowRecord,
  decodeEscrowData,
  planCreateEscrow,
  planEscrowAction,
} from "@ckb-escrow/sdk";

import { applyEscrowDeployment, getEscrowTypeScript } from "./deployment.js";
import type {
  EscrowActionTxParams,
  EscrowCreateTxParams,
  EscrowDeployment,
  EscrowSettlementTxParams,
  EscrowTransitionTxParams,
} from "./types.js";

function toCapacity(value: bigint | number | string | undefined, fallback: bigint): bigint {
  return value === undefined ? fallback : BigInt(value);
}

function createWitness(inputTypeHex: ccc.HexLike): ccc.Hex {
  return ccc.hexFrom(
    ccc.WitnessArgs.from({
      inputType: inputTypeHex,
    }).toBytes(),
  );
}

function createEmptyWitness(): ccc.Hex {
  return ccc.hexFrom(ccc.WitnessArgs.from({}).toBytes());
}

function fillWitnessesForInputCount(tx: ccc.Transaction, firstWitness: ccc.Hex): void {
  tx.witnesses = [firstWitness];
  while (tx.witnesses.length < tx.inputs.length) {
    tx.witnesses.push(createEmptyWitness());
  }
}

function decodeEscrowCell(cellLike: ccc.CellLike) {
  const cell = ccc.Cell.from(cellLike);
  return decodeEscrowData(cell.outputData);
}

function addSignerInput(tx: ccc.Transaction, signerInput?: ccc.CellInputLike): void {
  if (signerInput) {
    tx.addInput(signerInput);
  }
}

function addHeaderDeps(tx: ccc.Transaction, headerDeps?: ccc.HexLike[]): void {
  if (!headerDeps) {
    return;
  }

  for (const headerDep of headerDeps) {
    tx.headerDeps.push(ccc.hexFrom(headerDep));
  }
}

export function buildCreateEscrowTransaction(
  deployment: EscrowDeployment,
  params: EscrowCreateTxParams,
): ccc.Transaction {
  const record = createEscrowRecord({
    buyerLockHash: ccc.Script.from(params.buyerLock).hash(),
    sellerLockHash: ccc.Script.from(params.sellerLock).hash(),
    arbitratorLockHash: ccc.Script.from(params.arbitratorLock).hash(),
    amountShannons: params.amountShannons,
    deadlineMs: params.deadlineMs,
    state: "Funded",
    description: params.description,
  });

  const plan = planCreateEscrow(record);
  if (plan.kind !== "create") {
    throw new Error("Create escrow planning must return a create plan");
  }
  const tx = applyEscrowDeployment(ccc.Transaction.default(), deployment);

  tx.addOutput(
    {
      lock: params.escrowLock,
      type: getEscrowTypeScript(deployment),
      capacity: toCapacity(params.capacity, record.amountShannons),
    },
    plan.outputDataHex,
  );

  return tx;
}

export function buildDeliverTransaction(
  deployment: EscrowDeployment,
  params: EscrowTransitionTxParams,
): ccc.Transaction {
  const escrow = decodeEscrowCell(params.escrowInput);
  const plan = planEscrowAction(escrow, "Deliver");

  if (plan.kind !== "transition") {
    throw new Error("Deliver action must produce a transition plan");
  }

  const tx = applyEscrowDeployment(ccc.Transaction.default(), deployment);
  tx.addInput(params.escrowInput);
  addSignerInput(tx, params.signerInput);
  tx.addOutput(
    {
      lock: params.escrowLock,
      type: getEscrowTypeScript(deployment),
      capacity: toCapacity(params.capacity, ccc.Cell.from(params.escrowInput).cellOutput.capacity),
    },
    plan.outputDataHex,
  );
  fillWitnessesForInputCount(tx, createWitness(plan.witness.payloadHex));

  return tx;
}

export function buildDisputeTransaction(
  deployment: EscrowDeployment,
  params: EscrowTransitionTxParams,
): ccc.Transaction {
  const escrow = decodeEscrowCell(params.escrowInput);
  const plan = planEscrowAction(escrow, "Dispute");

  if (plan.kind !== "transition") {
    throw new Error("Dispute action must produce a transition plan");
  }

  const tx = applyEscrowDeployment(ccc.Transaction.default(), deployment);
  tx.addInput(params.escrowInput);
  addSignerInput(tx, params.signerInput);
  tx.addOutput(
    {
      lock: params.escrowLock,
      type: getEscrowTypeScript(deployment),
      capacity: toCapacity(params.capacity, ccc.Cell.from(params.escrowInput).cellOutput.capacity),
    },
    plan.outputDataHex,
  );
  fillWitnessesForInputCount(tx, createWitness(plan.witness.payloadHex));

  return tx;
}

export function buildSettlementTransaction(
  deployment: EscrowDeployment,
  action: "Cancel" | "Refund" | "Complete" | "ResolveToBuyer" | "ResolveToSeller",
  params: EscrowSettlementTxParams,
): ccc.Transaction {
  const escrow = decodeEscrowCell(params.escrowInput);
  const plan = planEscrowAction(
    escrow,
    action,
    params.referenceTimestampMs === undefined
      ? undefined
      : { referenceTimestampMs: params.referenceTimestampMs },
  );

  if (plan.kind !== "settlement") {
    throw new Error(`${action} must produce a settlement plan`);
  }

  const tx = applyEscrowDeployment(ccc.Transaction.default(), deployment);
  tx.addInput(params.escrowInput);
  addSignerInput(tx, params.signerInput);
  tx.addOutput(
    {
      lock: params.recipientLock,
      capacity: toCapacity(params.recipientCapacity, plan.minimumPayoutShannons),
    },
    "0x",
  );
  addHeaderDeps(tx, params.headerDeps);
  fillWitnessesForInputCount(tx, createWitness(plan.witness.payloadHex));

  return tx;
}

export async function completeFeeBySigner(
  tx: ccc.Transaction,
  signer: ccc.Signer,
  options?: {
    feeRate?: ccc.NumLike;
  },
): Promise<ccc.Transaction> {
  await tx.completeFeeBy(signer, options?.feeRate);
  return tx;
}
