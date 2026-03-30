import { encodeEscrowActionHex, encodeEscrowDataHex } from "./codec.js";
import { EscrowProtocolError } from "./errors.js";
import type {
  CreateEscrowPlan,
  EscrowAction,
  EscrowRecord,
  EscrowState,
  RequiredSigner,
  SettlementEscrowPlan,
  TransitionEscrowPlan,
} from "./types.js";

function invalidTransition(state: EscrowState, action: EscrowAction): never {
  throw new EscrowProtocolError(
    "INVALID_TRANSITION",
    `Action ${action} is not valid from state ${state}`,
  );
}

export function getRequiredSigner(state: EscrowState, action: EscrowAction): RequiredSigner {
  switch (`${state}:${action}`) {
    case "Funded:Deliver":
      return "seller";
    case "Funded:Cancel":
    case "Funded:Refund":
      return "buyer";
    case "Delivered:Complete":
      return "buyer";
    case "Delivered:Dispute":
      return "buyer_or_seller";
    case "Disputed:ResolveToBuyer":
    case "Disputed:ResolveToSeller":
      return "arbitrator";
    default:
      return invalidTransition(state, action);
  }
}

export function getNextEscrowState(
  state: EscrowState,
  action: EscrowAction,
): EscrowState | null {
  switch (`${state}:${action}`) {
    case "Funded:Deliver":
      return "Delivered";
    case "Delivered:Dispute":
      return "Disputed";
    case "Funded:Cancel":
    case "Funded:Refund":
    case "Delivered:Complete":
    case "Disputed:ResolveToBuyer":
    case "Disputed:ResolveToSeller":
      return null;
    default:
      return invalidTransition(state, action);
  }
}

export function isTerminalAction(state: EscrowState, action: EscrowAction): boolean {
  return getNextEscrowState(state, action) === null;
}

export function assertDeadlineReached(
  escrow: EscrowRecord,
  referenceTimestampMs: bigint,
): void {
  if (referenceTimestampMs < escrow.deadlineMs) {
    throw new EscrowProtocolError(
      "DEADLINE_NOT_REACHED",
      `Reference timestamp ${referenceTimestampMs} is before escrow deadline ${escrow.deadlineMs}`,
    );
  }
}

export function createEscrowPlan(record: EscrowRecord): CreateEscrowPlan {
  if (record.state !== "Funded") {
    throw new EscrowProtocolError(
      "INVALID_CREATION_STATE",
      "Escrow creation must start in Funded state",
    );
  }

  return {
    kind: "create",
    action: null,
    inputState: null,
    requiredSigner: "buyer",
    outputState: "Funded",
    outputDataHex: encodeEscrowDataHex(record),
  };
}

export function createTransitionPlan(
  input: EscrowRecord,
  action: Extract<EscrowAction, "Deliver" | "Dispute">,
): TransitionEscrowPlan {
  const outputState = getNextEscrowState(input.state, action);
  if (!outputState) {
    throw new EscrowProtocolError(
      "INVALID_TRANSITION",
      "Continuing transition requires a non-terminal next state",
    );
  }

  const output = { ...input, state: outputState } satisfies EscrowRecord;
  return {
    kind: "transition",
    action,
    inputState: input.state,
    outputState,
    outputDataHex: encodeEscrowDataHex(output),
    requiredSigner: getRequiredSigner(input.state, action),
    witness: {
      action,
      payloadHex: encodeEscrowActionHex(action),
    },
  };
}

export function createSettlementPlan(
  input: EscrowRecord,
  action: Extract<
    EscrowAction,
    "Cancel" | "Refund" | "Complete" | "ResolveToBuyer" | "ResolveToSeller"
  >,
): SettlementEscrowPlan {
  const requiredSigner = getRequiredSigner(input.state, action);

  const recipientLockHash =
    action === "Complete" || action === "ResolveToSeller"
      ? input.sellerLockHash
      : input.buyerLockHash;

  return {
    kind: "settlement",
    action,
    inputState: input.state,
    recipientLockHash,
    minimumPayoutShannons: input.amountShannons,
    requiresReferenceTimestamp: action === "Refund",
    requiredSigner,
    witness: {
      action,
      payloadHex: encodeEscrowActionHex(action),
    },
  };
}
