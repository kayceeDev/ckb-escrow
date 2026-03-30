import type * as ccc from "@ckb-ccc/ccc";

export interface EscrowDeployment {
  typeScript: ccc.ScriptLike;
  cellDep: ccc.CellDepLike;
}

export interface EscrowPartiesLocks {
  buyerLock: ccc.ScriptLike;
  sellerLock: ccc.ScriptLike;
  arbitratorLock: ccc.ScriptLike;
}

export interface EscrowCreateTxParams extends EscrowPartiesLocks {
  escrowLock: ccc.ScriptLike;
  amountShannons: bigint | number | string;
  deadlineMs: bigint | number | string;
  description: string;
  capacity?: bigint | number | string;
}

export interface EscrowActionTxParams {
  escrowInput: ccc.CellLike;
  signerInput?: ccc.CellInputLike;
  referenceTimestampMs?: bigint;
  headerDeps?: ccc.HexLike[];
  feeRate?: ccc.NumLike;
}

export interface EscrowTransitionTxParams extends EscrowActionTxParams {
  escrowLock: ccc.ScriptLike;
  capacity?: bigint | number | string;
}

export interface EscrowSettlementTxParams extends EscrowActionTxParams {
  recipientLock: ccc.ScriptLike;
  recipientCapacity?: bigint | number | string;
}
