import type * as ccc from "@ckb-ccc/ccc";

export interface DeploymentFormState {
  codeHash: string;
  hashType: "type" | "data";
  args: string;
  depTxHash: string;
  depIndex: string;
}

export interface CreateEscrowFormState {
  sellerCodeHash: string;
  sellerArgs: string;
  arbitratorCodeHash: string;
  arbitratorArgs: string;
  escrowCodeHash: string;
  escrowArgs: string;
  amountShannons: string;
  deadlineMs: string;
  description: string;
}

export interface ActionFormState {
  escrowTxHash: string;
  escrowIndex: string;
  escrowCapacity: string;
  escrowLockCodeHash: string;
  escrowLockArgs: string;
  escrowDataHex: string;
  recipientCodeHash: string;
  recipientArgs: string;
  referenceTimestampMs: string;
  headerDepHash: string;
}

export interface WalletState {
  wallets: {
    name: string;
    icon: string;
    signers: ccc.SignerInfo[];
  }[];
  activeSigner: ccc.Signer | null;
}
