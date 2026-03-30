import { describe, expect, it } from "vitest";
import * as ccc from "@ckb-ccc/ccc";

import { EscrowService } from "./index.js";

const deployment = {
  typeScript: {
    codeHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    hashType: "type" as const,
    args: "0x",
  },
  cellDep: {
    outPoint: {
      txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      index: 0,
    },
    depType: "code" as const,
  },
};

const buyerLock = {
  codeHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
  hashType: "type" as const,
  args: "0x01",
};
const sellerLock = {
  codeHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
  hashType: "type" as const,
  args: "0x02",
};
const arbitratorLock = {
  codeHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
  hashType: "type" as const,
  args: "0x03",
};
const escrowLock = {
  codeHash: "0x4444444444444444444444444444444444444444444444444444444444444444",
  hashType: "type" as const,
  args: "0x04",
};

function escrowCell(stateCode: string): ccc.CellLike {
  return {
    outPoint: {
      txHash: "0x9999999999999999999999999999999999999999999999999999999999999999",
      index: 0,
    },
    cellOutput: {
      capacity: 2_000n,
      lock: escrowLock,
      type: deployment.typeScript,
    },
    outputData:
      `0x${ccc.Script.from(buyerLock).hash().slice(2)}${ccc.Script.from(sellerLock).hash().slice(2)}${ccc.Script.from(arbitratorLock).hash().slice(2)}00000000000003e80000018bcfe56800${stateCode}00107765627369746520726564657369676e` as `0x${string}`,
  };
}

function createMockSigner() {
  const address = ccc.Address.from({
    script: buyerLock,
    prefix: "ckt",
  });

  return {
    client: {} as ccc.Client,
    async getRecommendedAddressObj() {
      return address;
    },
    async sendTransaction(_tx: ccc.TransactionLike) {
      return "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
    },
  } as unknown as ccc.Signer;
}

describe("EscrowService", () => {
  it("defaults create escrow buyer lock to the active signer", async () => {
    const service = new EscrowService({
      deployment,
      signer: createMockSigner(),
    });

    const tx = await service.buildCreateEscrow({
      sellerLock,
      arbitratorLock,
      escrowLock,
      amountShannons: 1_000n,
      deadlineMs: 1_700_000_000_000n,
      description: "website redesign",
    });

    expect(tx.outputs).toHaveLength(1);
    expect(tx.outputsData[0]).toContain(ccc.Script.from(buyerLock).hash().slice(2));
  });

  it("builds refund transactions with signer recipient and header dep", async () => {
    const service = new EscrowService({
      deployment,
      signer: createMockSigner(),
    });

    const tx = await service.buildRefund({
      escrowInput: escrowCell("00"),
      referenceTimestampMs: 1_700_000_000_001n,
      headerDeps: [
        "0x5555555555555555555555555555555555555555555555555555555555555555",
      ],
    });

    expect(tx.outputs).toHaveLength(1);
    expect(tx.headerDeps).toHaveLength(1);
    expect(tx.outputs[0]?.lock.eq(buyerLock)).toBe(true);
  });

  it("builds seller resolution transactions with explicit recipient lock", () => {
    const service = new EscrowService({
      deployment,
      signer: createMockSigner(),
    });

    const tx = service.buildResolveToSeller({
      escrowInput: escrowCell("03"),
      recipientLock: sellerLock,
    });

    expect(tx.outputs).toHaveLength(1);
    expect(tx.outputs[0]?.lock.eq(sellerLock)).toBe(true);
  });
});
