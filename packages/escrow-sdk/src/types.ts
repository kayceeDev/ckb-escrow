import { ESCROW_ACTION_CODES, ESCROW_STATE_CODES } from "./constants.js";

export type Hex = `0x${string}`;

export type EscrowState = keyof typeof ESCROW_STATE_CODES;
export type EscrowAction = keyof typeof ESCROW_ACTION_CODES;

export type RequiredSigner =
  | "buyer"
  | "seller"
  | "arbitrator"
  | "buyer_or_seller";

export type EscrowPlanKind = "create" | "transition" | "settlement";

export interface EscrowParties {
  buyerLockHash: Hex;
  sellerLockHash: Hex;
  arbitratorLockHash: Hex;
}

export interface EscrowRecord extends EscrowParties {
  amountShannons: bigint;
  deadlineMs: bigint;
  state: EscrowState;
  description: Uint8Array;
}

export interface EscrowRecordInput extends EscrowParties {
  amountShannons: bigint | number | string;
  deadlineMs: bigint | number | string;
  state: EscrowState;
  description: Uint8Array | string;
}

export interface EscrowCellView extends EscrowRecord {
  dataHex: Hex;
  descriptionText: string;
}

export interface EscrowWitnessView {
  action: EscrowAction;
  payloadHex: Hex;
}

export interface BaseEscrowPlan {
  kind: EscrowPlanKind;
  action: EscrowAction | null;
  inputState: EscrowState | null;
  requiredSigner: RequiredSigner;
}

export interface CreateEscrowPlan extends BaseEscrowPlan {
  kind: "create";
  action: null;
  inputState: null;
  requiredSigner: "buyer";
  outputState: "Funded";
  outputDataHex: Hex;
}

export interface TransitionEscrowPlan extends BaseEscrowPlan {
  kind: "transition";
  action: EscrowAction;
  inputState: EscrowState;
  outputState: EscrowState;
  outputDataHex: Hex;
  witness: EscrowWitnessView;
}

export interface SettlementEscrowPlan extends BaseEscrowPlan {
  kind: "settlement";
  action: EscrowAction;
  inputState: EscrowState;
  recipientLockHash: Hex;
  minimumPayoutShannons: bigint;
  requiresReferenceTimestamp: boolean;
  witness: EscrowWitnessView;
}

export type EscrowTransactionPlan =
  | CreateEscrowPlan
  | TransitionEscrowPlan
  | SettlementEscrowPlan;
