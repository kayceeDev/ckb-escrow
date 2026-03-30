import * as ccc from "@ckb-ccc/ccc";
import {
  buildCreateEscrowTransaction,
  buildDeliverTransaction,
  buildDisputeTransaction,
  buildSettlementTransaction,
  completeFeeBySigner,
  type EscrowDeployment,
} from "@ckb-escrow/ccc-adapter";

import type {
  EscrowServiceCompleteParams,
  EscrowServiceCreateParams,
  EscrowServiceOptions,
  EscrowServiceRefundParams,
  EscrowServiceResolveParams,
} from "./types.js";

export class EscrowService {
  readonly deployment: EscrowDeployment;
  readonly signer: ccc.Signer;

  constructor(options: EscrowServiceOptions) {
    this.deployment = options.deployment;
    this.signer = options.signer;
  }

  private async currentSignerLock(): Promise<ccc.Script> {
    const address = await this.signer.getRecommendedAddressObj();
    return address.script;
  }

  private async finalizeAndSend(
    tx: ccc.Transaction,
    feeRate?: ccc.NumLike,
  ): Promise<ccc.Hex> {
    await completeFeeBySigner(
      tx,
      this.signer,
      feeRate === undefined ? undefined : { feeRate },
    );
    return this.signer.sendTransaction(tx as unknown as ccc.TransactionLike);
  }

  async buildCreateEscrow(params: EscrowServiceCreateParams): Promise<ccc.Transaction> {
    const buyerLock = params.buyerLock ?? (await this.currentSignerLock());
    return buildCreateEscrowTransaction(this.deployment, {
      ...params,
      buyerLock,
    });
  }

  async sendCreateEscrow(params: EscrowServiceCreateParams): Promise<ccc.Hex> {
    const tx = await this.buildCreateEscrow(params);
    return this.finalizeAndSend(tx, params.feeRate);
  }

  buildDeliver(escrowInput: ccc.CellLike): ccc.Transaction {
    return buildDeliverTransaction(this.deployment, {
      escrowInput,
      escrowLock: ccc.Cell.from(escrowInput).cellOutput.lock,
    });
  }

  async sendDeliver(
    escrowInput: ccc.CellLike,
    feeRate?: ccc.NumLike,
  ): Promise<ccc.Hex> {
    const tx = this.buildDeliver(escrowInput);
    return this.finalizeAndSend(tx, feeRate);
  }

  buildDispute(escrowInput: ccc.CellLike): ccc.Transaction {
    return buildDisputeTransaction(this.deployment, {
      escrowInput,
      escrowLock: ccc.Cell.from(escrowInput).cellOutput.lock,
    });
  }

  async sendDispute(
    escrowInput: ccc.CellLike,
    feeRate?: ccc.NumLike,
  ): Promise<ccc.Hex> {
    const tx = this.buildDispute(escrowInput);
    return this.finalizeAndSend(tx, feeRate);
  }

  async buildCancel(escrowInput: ccc.CellLike): Promise<ccc.Transaction> {
    return buildSettlementTransaction(this.deployment, "Cancel", {
      escrowInput,
      recipientLock: await this.currentSignerLock(),
    });
  }

  async sendCancel(
    escrowInput: ccc.CellLike,
    feeRate?: ccc.NumLike,
  ): Promise<ccc.Hex> {
    const tx = await this.buildCancel(escrowInput);
    return this.finalizeAndSend(tx, feeRate);
  }

  async buildRefund(params: EscrowServiceRefundParams): Promise<ccc.Transaction> {
    return buildSettlementTransaction(this.deployment, "Refund", {
      escrowInput: params.escrowInput,
      recipientLock: await this.currentSignerLock(),
      referenceTimestampMs: params.referenceTimestampMs,
      headerDeps: params.headerDeps,
    });
  }

  async sendRefund(params: EscrowServiceRefundParams): Promise<ccc.Hex> {
    const tx = await this.buildRefund(params);
    return this.finalizeAndSend(tx, params.feeRate);
  }

  buildComplete(params: EscrowServiceCompleteParams): ccc.Transaction {
    return buildSettlementTransaction(this.deployment, "Complete", {
      escrowInput: params.escrowInput,
      recipientLock: params.sellerLock,
    });
  }

  async sendComplete(params: EscrowServiceCompleteParams): Promise<ccc.Hex> {
    const tx = this.buildComplete(params);
    return this.finalizeAndSend(tx, params.feeRate);
  }

  buildResolveToBuyer(params: EscrowServiceResolveParams): ccc.Transaction {
    return buildSettlementTransaction(this.deployment, "ResolveToBuyer", {
      escrowInput: params.escrowInput,
      recipientLock: params.recipientLock,
    });
  }

  async sendResolveToBuyer(params: EscrowServiceResolveParams): Promise<ccc.Hex> {
    const tx = this.buildResolveToBuyer(params);
    return this.finalizeAndSend(tx, params.feeRate);
  }

  buildResolveToSeller(params: EscrowServiceResolveParams): ccc.Transaction {
    return buildSettlementTransaction(this.deployment, "ResolveToSeller", {
      escrowInput: params.escrowInput,
      recipientLock: params.recipientLock,
    });
  }

  async sendResolveToSeller(params: EscrowServiceResolveParams): Promise<ccc.Hex> {
    const tx = this.buildResolveToSeller(params);
    return this.finalizeAndSend(tx, params.feeRate);
  }
}
