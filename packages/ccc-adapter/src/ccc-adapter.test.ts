import { describe, expect, it } from "vitest";
import * as ccc from "@ckb-ccc/ccc";

import {
  buildCreateEscrowTransaction,
  buildDisputeTransaction,
  buildSettlementTransaction,
} from "./index.js";

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

describe("ccc adapter", () => {
  it("builds a create transaction with deployment cell dep", () => {
    const tx = buildCreateEscrowTransaction(deployment, {
      buyerLock,
      sellerLock,
      arbitratorLock,
      escrowLock,
      amountShannons: 1_000n,
      deadlineMs: 1_700_000_000_000n,
      description: "website redesign",
    });

    expect(tx.cellDeps).toHaveLength(1);
    expect(tx.outputs).toHaveLength(1);
    expect(tx.outputsData).toHaveLength(1);
  });

  it("builds a dispute transaction with a dispute witness", () => {
    const tx = buildDisputeTransaction(deployment, {
      escrowInput: escrowCell("01"),
      signerInput: {
        previousOutput: {
          txHash: "0x7777777777777777777777777777777777777777777777777777777777777777",
          index: 1,
        },
      },
      escrowLock,
    });

    expect(tx.inputs).toHaveLength(2);
    expect(tx.witnesses[0]).toBeDefined();
    expect(tx.outputsData[0]).toContain("03");
  });

  it("builds a resolution settlement transaction for seller", () => {
    const tx = buildSettlementTransaction(deployment, "ResolveToSeller", {
      escrowInput: escrowCell("03"),
      recipientLock: sellerLock,
      headerDeps: [
        "0x5555555555555555555555555555555555555555555555555555555555555555",
      ],
    });

    expect(tx.inputs).toHaveLength(1);
    expect(tx.outputs).toHaveLength(1);
    expect(tx.headerDeps).toHaveLength(1);
  });
});
