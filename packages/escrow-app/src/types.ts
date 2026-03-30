import type * as ccc from "@ckb-ccc/ccc";
import type {
  EscrowCreateTxParams,
  EscrowDeployment,
} from "@ckb-escrow/ccc-adapter";

export interface EscrowServiceCreateParams
  extends Omit<EscrowCreateTxParams, "buyerLock"> {
  buyerLock?: ccc.ScriptLike;
  feeRate?: ccc.NumLike;
}

export interface EscrowServiceActionBase {
  escrowInput: ccc.CellLike;
  feeRate?: ccc.NumLike;
}

export interface EscrowServiceRefundParams extends EscrowServiceActionBase {
  referenceTimestampMs: bigint;
  headerDeps: ccc.HexLike[];
}

export interface EscrowServiceResolveParams extends EscrowServiceActionBase {
  recipientLock: ccc.ScriptLike;
}

export interface EscrowServiceCompleteParams extends EscrowServiceActionBase {
  sellerLock: ccc.ScriptLike;
}

export interface EscrowServiceOptions {
  deployment: EscrowDeployment;
  signer: ccc.Signer;
}
