import type { ChangeEvent } from "react";

import type { ActionFormState } from "../types.js";

interface ActionsPageProps {
  actionForm: ActionFormState;
  busy: boolean;
  onUpdate: <K extends keyof ActionFormState>(
    key: K,
    value: ActionFormState[K],
  ) => void;
  onPreviewDeliver: () => void;
  onSendDeliver: () => void;
  onPreviewDispute: () => void;
  onSendDispute: () => void;
  onPreviewRefund: () => void;
  onSendRefund: () => void;
  onPreviewResolveToSeller: () => void;
  onSendResolveToSeller: () => void;
}

export function ActionsPage({
  actionForm,
  busy,
  onUpdate,
  onPreviewDeliver,
  onSendDeliver,
  onPreviewDispute,
  onSendDispute,
  onPreviewRefund,
  onSendRefund,
  onPreviewResolveToSeller,
  onSendResolveToSeller,
}: ActionsPageProps) {
  return (
    <section className="panel">
      <h2>Operate Escrow</h2>
      <p className="muted">
        Load an escrow cell and then prepare or submit deliver, dispute, refund, and resolve flows.
      </p>
      <div className="form-grid">
        <label>
          <span>Escrow Tx Hash</span>
          <input
            value={actionForm.escrowTxHash}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("escrowTxHash", event.target.value)
            }
            placeholder="0x..."
          />
        </label>
        <label>
          <span>Escrow Index</span>
          <input
            value={actionForm.escrowIndex}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("escrowIndex", event.target.value)
            }
          />
        </label>
        <label>
          <span>Escrow Capacity</span>
          <input
            value={actionForm.escrowCapacity}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("escrowCapacity", event.target.value)
            }
          />
        </label>
        <label>
          <span>Escrow Lock Code Hash</span>
          <input
            value={actionForm.escrowLockCodeHash}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("escrowLockCodeHash", event.target.value)
            }
            placeholder="0x..."
          />
        </label>
        <label>
          <span>Escrow Lock Args</span>
          <input
            value={actionForm.escrowLockArgs}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("escrowLockArgs", event.target.value)
            }
          />
        </label>
        <label className="wide">
          <span>Escrow Data Hex</span>
          <textarea
            value={actionForm.escrowDataHex}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              onUpdate("escrowDataHex", event.target.value)
            }
          />
        </label>
        <label>
          <span>Recipient Code Hash</span>
          <input
            value={actionForm.recipientCodeHash}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("recipientCodeHash", event.target.value)
            }
            placeholder="0x..."
          />
        </label>
        <label>
          <span>Recipient Args</span>
          <input
            value={actionForm.recipientArgs}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("recipientArgs", event.target.value)
            }
          />
        </label>
        <label>
          <span>Reference Timestamp (refund)</span>
          <input
            value={actionForm.referenceTimestampMs}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("referenceTimestampMs", event.target.value)
            }
          />
        </label>
        <label>
          <span>Header Dep Hash (refund)</span>
          <input
            value={actionForm.headerDepHash}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("headerDepHash", event.target.value)
            }
            placeholder="0x..."
          />
        </label>
      </div>
      <div className="actions">
        <button onClick={onPreviewDeliver} disabled={busy}>
          Preview Deliver
        </button>
        <button onClick={onSendDeliver} disabled={busy}>
          Send Deliver
        </button>
        <button onClick={onPreviewDispute} disabled={busy}>
          Preview Dispute
        </button>
        <button onClick={onSendDispute} disabled={busy}>
          Send Dispute
        </button>
        <button onClick={onPreviewRefund} disabled={busy}>
          Preview Refund
        </button>
        <button onClick={onSendRefund} disabled={busy}>
          Send Refund
        </button>
        <button onClick={onPreviewResolveToSeller} disabled={busy}>
          Preview Resolve To Seller
        </button>
        <button onClick={onSendResolveToSeller} disabled={busy}>
          Send Resolve To Seller
        </button>
      </div>
    </section>
  );
}
