import { describe, expect, it } from "vitest";

import {
  createEscrowRecord,
  decodeEscrowAction,
  decodeEscrowData,
  encodeEscrowActionHex,
  encodeEscrowDataHex,
  planCreateEscrow,
  planEscrowAction,
} from "./index.js";

const buyerLockHash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const sellerLockHash =
  "0x2222222222222222222222222222222222222222222222222222222222222222";
const arbitratorLockHash =
  "0x3333333333333333333333333333333333333333333333333333333333333333";

describe("escrow codec", () => {
  it("roundtrips escrow cell data", () => {
    const encoded = encodeEscrowDataHex({
      buyerLockHash,
      sellerLockHash,
      arbitratorLockHash,
      amountShannons: 1_000n,
      deadlineMs: 1_700_000_000_000n,
      state: "Funded",
      description: "website redesign",
    });

    const decoded = decodeEscrowData(encoded);

    expect(decoded.buyerLockHash).toBe(buyerLockHash);
    expect(decoded.sellerLockHash).toBe(sellerLockHash);
    expect(decoded.arbitratorLockHash).toBe(arbitratorLockHash);
    expect(decoded.amountShannons).toBe(1_000n);
    expect(decoded.deadlineMs).toBe(1_700_000_000_000n);
    expect(decoded.state).toBe("Funded");
    expect(decoded.descriptionText).toBe("website redesign");
  });

  it("encodes and decodes witness actions", () => {
    const payloadHex = encodeEscrowActionHex("ResolveToSeller");
    const decoded = decodeEscrowAction(payloadHex);

    expect(payloadHex).toBe("0x07");
    expect(decoded.action).toBe("ResolveToSeller");
  });
});

describe("escrow planning", () => {
  it("builds a create plan from funded escrow input", () => {
    const plan = planCreateEscrow({
      buyerLockHash,
      sellerLockHash,
      arbitratorLockHash,
      amountShannons: 1_000n,
      deadlineMs: 1_700_000_000_000n,
      state: "Funded",
      description: "website redesign",
    });

    expect(plan.kind).toBe("create");
    if (plan.kind !== "create") {
      throw new Error("expected create plan");
    }
    expect(plan.requiredSigner).toBe("buyer");
    expect(plan.outputState).toBe("Funded");
  });

  it("builds a dispute resolution settlement plan for the arbitrator", () => {
    const escrow = createEscrowRecord({
      buyerLockHash,
      sellerLockHash,
      arbitratorLockHash,
      amountShannons: 1_000n,
      deadlineMs: 1_700_000_000_000n,
      state: "Disputed",
      description: "website redesign",
    });

    const plan = planEscrowAction(escrow, "ResolveToSeller");

    expect(plan.kind).toBe("settlement");
    if (plan.kind !== "settlement") {
      throw new Error("expected settlement plan");
    }
    expect(plan.requiredSigner).toBe("arbitrator");
    expect(plan.recipientLockHash).toBe(sellerLockHash);
    expect(plan.minimumPayoutShannons).toBe(1_000n);
  });

  it("rejects refund planning when the deadline has not been reached", () => {
    const escrow = createEscrowRecord({
      buyerLockHash,
      sellerLockHash,
      arbitratorLockHash,
      amountShannons: 1_000n,
      deadlineMs: 1_700_000_000_000n,
      state: "Funded",
      description: "website redesign",
    });

    expect(() =>
      planEscrowAction(escrow, "Refund", {
        referenceTimestampMs: 1_699_999_999_999n,
      }),
    ).toThrow(/DEADLINE_NOT_REACHED|before escrow deadline/);
  });
});
