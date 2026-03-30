import type { ChangeEvent } from "react";

import type { CreateEscrowFormState } from "../types.js";

interface CreatePageProps {
  createForm: CreateEscrowFormState;
  busy: boolean;
  onUpdate: <K extends keyof CreateEscrowFormState>(
    key: K,
    value: CreateEscrowFormState[K],
  ) => void;
  onPreview: () => void;
  onSend: () => void;
}

export function CreatePage({
  createForm,
  busy,
  onUpdate,
  onPreview,
  onSend,
}: CreatePageProps) {
  return (
    <section className="panel">
      <h2>Create Escrow</h2>
      <p className="muted">
        Configure seller, arbitrator, escrow lock, amount, deadline, and description for a new escrow cell.
      </p>
      <div className="form-grid">
        <label>
          <span>Seller Lock Code Hash</span>
          <input
            value={createForm.sellerCodeHash}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("sellerCodeHash", event.target.value)
            }
            placeholder="0x..."
          />
        </label>
        <label>
          <span>Seller Args</span>
          <input
            value={createForm.sellerArgs}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("sellerArgs", event.target.value)
            }
          />
        </label>
        <label>
          <span>Arbitrator Lock Code Hash</span>
          <input
            value={createForm.arbitratorCodeHash}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("arbitratorCodeHash", event.target.value)
            }
            placeholder="0x..."
          />
        </label>
        <label>
          <span>Arbitrator Args</span>
          <input
            value={createForm.arbitratorArgs}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("arbitratorArgs", event.target.value)
            }
          />
        </label>
        <label>
          <span>Escrow Lock Code Hash</span>
          <input
            value={createForm.escrowCodeHash}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("escrowCodeHash", event.target.value)
            }
            placeholder="0x..."
          />
        </label>
        <label>
          <span>Escrow Args</span>
          <input
            value={createForm.escrowArgs}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("escrowArgs", event.target.value)
            }
          />
        </label>
        <label>
          <span>Amount (shannons)</span>
          <input
            value={createForm.amountShannons}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("amountShannons", event.target.value)
            }
          />
        </label>
        <label>
          <span>Deadline (ms)</span>
          <input
            value={createForm.deadlineMs}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("deadlineMs", event.target.value)
            }
          />
        </label>
        <label className="wide">
          <span>Description</span>
          <input
            value={createForm.description}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUpdate("description", event.target.value)
            }
          />
        </label>
      </div>
      <div className="actions">
        <button onClick={onPreview} disabled={busy}>
          Preview Create
        </button>
        <button onClick={onSend} disabled={busy}>
          Send Create
        </button>
      </div>
    </section>
  );
}
