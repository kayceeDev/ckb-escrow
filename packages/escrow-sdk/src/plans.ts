import { createEscrowRecord, decodeEscrowData } from "./codec.js";
import type {
  EscrowAction,
  EscrowRecord,
  EscrowRecordInput,
  EscrowTransactionPlan,
} from "./types.js";
import {
  assertDeadlineReached,
  createEscrowPlan,
  createSettlementPlan,
  createTransitionPlan,
  isTerminalAction,
} from "./validation.js";

export function planCreateEscrow(input: EscrowRecordInput): EscrowTransactionPlan {
  const record = createEscrowRecord(input);
  return createEscrowPlan(record);
}

export function planEscrowAction(
  escrow: EscrowRecord,
  action: EscrowAction,
  options?: { referenceTimestampMs?: bigint },
): EscrowTransactionPlan {
  if (isTerminalAction(escrow.state, action)) {
    if (action === "Refund" && options?.referenceTimestampMs !== undefined) {
      assertDeadlineReached(escrow, options.referenceTimestampMs);
    }

    return createSettlementPlan(
      escrow,
      action as Extract<
        EscrowAction,
        "Cancel" | "Refund" | "Complete" | "ResolveToBuyer" | "ResolveToSeller"
      >,
    );
  }

  return createTransitionPlan(escrow, action as Extract<EscrowAction, "Deliver" | "Dispute">);
}

export function planEscrowActionFromCellData(
  dataHex: `0x${string}`,
  action: EscrowAction,
  options?: { referenceTimestampMs?: bigint },
): EscrowTransactionPlan {
  const escrow = decodeEscrowData(dataHex);
  return planEscrowAction(escrow, action, options);
}
