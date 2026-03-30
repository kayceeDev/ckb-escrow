import * as ccc from "@ckb-ccc/ccc";
import { EscrowService } from "@ckb-escrow/app";
import { useEffect, useState } from "react";

import type {
  ActionFormState,
  CreateEscrowFormState,
  DeploymentFormState,
  WalletState,
} from "./types.js";

const testnetClient = new ccc.ClientPublicTestnet();

const initialDeployment: DeploymentFormState = {
  codeHash: "",
  hashType: "type",
  args: "0x",
  depTxHash: "",
  depIndex: "0",
};

const initialCreateForm: CreateEscrowFormState = {
  sellerCodeHash: "",
  sellerArgs: "0x",
  arbitratorCodeHash: "",
  arbitratorArgs: "0x",
  escrowCodeHash: "",
  escrowArgs: "0x",
  amountShannons: "100000000",
  deadlineMs: "1700000000000",
  description: "Website redesign milestone",
};

const initialActionForm: ActionFormState = {
  escrowTxHash: "",
  escrowIndex: "0",
  escrowCapacity: "200000000",
  escrowLockCodeHash: "",
  escrowLockArgs: "0x",
  escrowDataHex: "0x",
  recipientCodeHash: "",
  recipientArgs: "0x",
  referenceTimestampMs: "",
  headerDepHash: "",
};

function makeTypeScript(form: DeploymentFormState): ccc.ScriptLike {
  return {
    codeHash: form.codeHash || "0x",
    hashType: form.hashType,
    args: form.args || "0x",
  };
}

function makeCellDep(form: DeploymentFormState): ccc.CellDepLike {
  return {
    outPoint: {
      txHash: form.depTxHash || "0x",
      index: BigInt(form.depIndex || "0"),
    },
    depType: "code",
  };
}

function makeLock(codeHash: string, args: string): ccc.ScriptLike {
  return {
    codeHash: codeHash || "0x",
    hashType: "type",
    args: args || "0x",
  };
}

function makeEscrowCell(action: ActionFormState, deployment: DeploymentFormState): ccc.CellLike {
  return {
    outPoint: {
      txHash: action.escrowTxHash || "0x",
      index: BigInt(action.escrowIndex || "0"),
    },
    cellOutput: {
      capacity: BigInt(action.escrowCapacity || "0"),
      lock: makeLock(action.escrowLockCodeHash, action.escrowLockArgs),
      type: makeTypeScript(deployment),
    },
    outputData: action.escrowDataHex || "0x",
  };
}

export function App() {
  const [walletState, setWalletState] = useState<WalletState>({
    wallets: [],
    activeSigner: null,
  });
  const [deployment, setDeployment] = useState(initialDeployment);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [actionForm, setActionForm] = useState(initialActionForm);
  const [txPreview, setTxPreview] = useState<string>("");
  const [status, setStatus] = useState<string>("Idle");

  useEffect(() => {
    const controller = new ccc.SignersController();

    void controller.refresh(testnetClient, (wallets) => {
      setWalletState((current) => ({
        wallets,
        activeSigner: current.activeSigner,
      }));
    });

    return () => controller.disconnect();
  }, []);

  const service = walletState.activeSigner
    ? new EscrowService({
        deployment: {
          typeScript: makeTypeScript(deployment),
          cellDep: makeCellDep(deployment),
        },
        signer: walletState.activeSigner,
      })
    : null;

  async function previewCreate() {
    if (!service) {
      setStatus("Select a signer before building transactions.");
      return;
    }

    const tx = await service.buildCreateEscrow({
      sellerLock: makeLock(createForm.sellerCodeHash, createForm.sellerArgs),
      arbitratorLock: makeLock(
        createForm.arbitratorCodeHash,
        createForm.arbitratorArgs,
      ),
      escrowLock: makeLock(createForm.escrowCodeHash, createForm.escrowArgs),
      amountShannons: BigInt(createForm.amountShannons),
      deadlineMs: BigInt(createForm.deadlineMs),
      description: createForm.description,
    });

    setTxPreview(JSON.stringify(tx, null, 2));
    setStatus("Create transaction prepared.");
  }

  async function previewDeliver() {
    if (!service) {
      setStatus("Select a signer before building transactions.");
      return;
    }

    const tx = service.buildDeliver(makeEscrowCell(actionForm, deployment));
    setTxPreview(JSON.stringify(tx, null, 2));
    setStatus("Deliver transaction prepared.");
  }

  async function previewDispute() {
    if (!service) {
      setStatus("Select a signer before building transactions.");
      return;
    }

    const tx = service.buildDispute(makeEscrowCell(actionForm, deployment));
    setTxPreview(JSON.stringify(tx, null, 2));
    setStatus("Dispute transaction prepared.");
  }

  async function previewRefund() {
    if (!service) {
      setStatus("Select a signer before building transactions.");
      return;
    }

    const tx = await service.buildRefund({
      escrowInput: makeEscrowCell(actionForm, deployment),
      referenceTimestampMs: BigInt(actionForm.referenceTimestampMs || "0"),
      headerDeps: actionForm.headerDepHash ? [actionForm.headerDepHash] : [],
    });
    setTxPreview(JSON.stringify(tx, null, 2));
    setStatus("Refund transaction prepared.");
  }

  async function previewResolveToSeller() {
    if (!service) {
      setStatus("Select a signer before building transactions.");
      return;
    }

    const tx = service.buildResolveToSeller({
      escrowInput: makeEscrowCell(actionForm, deployment),
      recipientLock: makeLock(actionForm.recipientCodeHash, actionForm.recipientArgs),
    });
    setTxPreview(JSON.stringify(tx, null, 2));
    setStatus("Resolve-to-seller transaction prepared.");
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">CKB Escrow Studio</p>
          <h1>Protocol-aware frontend for goods and services escrow on CKB.</h1>
          <p className="lede">
            This frontend sits on top of the escrow app service, CCC adapter, and protocol SDK.
            It is designed to prepare real transaction flows instead of scattering chain logic across UI components.
          </p>
        </div>
        <div className="status-card">
          <span className="status-label">Status</span>
          <strong>{status}</strong>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <h2>Wallets</h2>
          <p className="muted">Discovered through CCC signers controller on CKB testnet.</p>
          <div className="wallet-list">
            {walletState.wallets.length === 0 ? (
              <p className="empty">No wallets discovered yet.</p>
            ) : (
              walletState.wallets.map((wallet) => (
                <div key={wallet.name} className="wallet-card">
                  <div>
                    <strong>{wallet.name}</strong>
                    <p className="muted">{wallet.signers.length} signer(s)</p>
                  </div>
                  <div className="signer-list">
                    {wallet.signers.map((signerInfo) => (
                      <button
                        key={`${wallet.name}-${signerInfo.name}`}
                        className={
                          walletState.activeSigner === signerInfo.signer
                            ? "signer-button active"
                            : "signer-button"
                        }
                        onClick={() =>
                          setWalletState((current) => ({
                            ...current,
                            activeSigner: signerInfo.signer,
                          }))
                        }
                      >
                        {signerInfo.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Deployment</h2>
          <div className="form-grid">
            <label>
              <span>Type Script Code Hash</span>
              <input
                value={deployment.codeHash}
                onChange={(event) =>
                  setDeployment((current) => ({ ...current, codeHash: event.target.value }))
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Hash Type</span>
              <select
                value={deployment.hashType}
                onChange={(event) =>
                  setDeployment((current) => ({
                    ...current,
                    hashType: event.target.value as "type" | "data",
                  }))
                }
              >
                <option value="type">type</option>
                <option value="data">data</option>
              </select>
            </label>
            <label>
              <span>Args</span>
              <input
                value={deployment.args}
                onChange={(event) =>
                  setDeployment((current) => ({ ...current, args: event.target.value }))
                }
                placeholder="0x"
              />
            </label>
            <label>
              <span>Cell Dep Tx Hash</span>
              <input
                value={deployment.depTxHash}
                onChange={(event) =>
                  setDeployment((current) => ({ ...current, depTxHash: event.target.value }))
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Cell Dep Index</span>
              <input
                value={deployment.depIndex}
                onChange={(event) =>
                  setDeployment((current) => ({ ...current, depIndex: event.target.value }))
                }
              />
            </label>
          </div>
        </section>

        <section className="panel">
          <h2>Create Escrow</h2>
          <div className="form-grid">
            <label>
              <span>Seller Lock Code Hash</span>
              <input
                value={createForm.sellerCodeHash}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    sellerCodeHash: event.target.value,
                  }))
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Seller Args</span>
              <input
                value={createForm.sellerArgs}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, sellerArgs: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Arbitrator Lock Code Hash</span>
              <input
                value={createForm.arbitratorCodeHash}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    arbitratorCodeHash: event.target.value,
                  }))
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Arbitrator Args</span>
              <input
                value={createForm.arbitratorArgs}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    arbitratorArgs: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Escrow Lock Code Hash</span>
              <input
                value={createForm.escrowCodeHash}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    escrowCodeHash: event.target.value,
                  }))
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Escrow Args</span>
              <input
                value={createForm.escrowArgs}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, escrowArgs: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Amount (shannons)</span>
              <input
                value={createForm.amountShannons}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    amountShannons: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Deadline (ms)</span>
              <input
                value={createForm.deadlineMs}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    deadlineMs: event.target.value,
                  }))
                }
              />
            </label>
            <label className="wide">
              <span>Description</span>
              <input
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="actions">
            <button onClick={() => void previewCreate()}>Preview Create</button>
          </div>
        </section>

        <section className="panel">
          <h2>Escrow Actions</h2>
          <div className="form-grid">
            <label>
              <span>Escrow Tx Hash</span>
              <input
                value={actionForm.escrowTxHash}
                onChange={(event) =>
                  setActionForm((current) => ({
                    ...current,
                    escrowTxHash: event.target.value,
                  }))
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Escrow Index</span>
              <input
                value={actionForm.escrowIndex}
                onChange={(event) =>
                  setActionForm((current) => ({
                    ...current,
                    escrowIndex: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Escrow Capacity</span>
              <input
                value={actionForm.escrowCapacity}
                onChange={(event) =>
                  setActionForm((current) => ({
                    ...current,
                    escrowCapacity: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Escrow Lock Code Hash</span>
              <input
                value={actionForm.escrowLockCodeHash}
                onChange={(event) =>
                  setActionForm((current) => ({
                    ...current,
                    escrowLockCodeHash: event.target.value,
                  }))
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Escrow Lock Args</span>
              <input
                value={actionForm.escrowLockArgs}
                onChange={(event) =>
                  setActionForm((current) => ({
                    ...current,
                    escrowLockArgs: event.target.value,
                  }))
                }
              />
            </label>
            <label className="wide">
              <span>Escrow Data Hex</span>
              <textarea
                value={actionForm.escrowDataHex}
                onChange={(event) =>
                  setActionForm((current) => ({
                    ...current,
                    escrowDataHex: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Recipient Code Hash</span>
              <input
                value={actionForm.recipientCodeHash}
                onChange={(event) =>
                  setActionForm((current) => ({
                    ...current,
                    recipientCodeHash: event.target.value,
                  }))
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Recipient Args</span>
              <input
                value={actionForm.recipientArgs}
                onChange={(event) =>
                  setActionForm((current) => ({
                    ...current,
                    recipientArgs: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Reference Timestamp (refund)</span>
              <input
                value={actionForm.referenceTimestampMs}
                onChange={(event) =>
                  setActionForm((current) => ({
                    ...current,
                    referenceTimestampMs: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Header Dep Hash (refund)</span>
              <input
                value={actionForm.headerDepHash}
                onChange={(event) =>
                  setActionForm((current) => ({
                    ...current,
                    headerDepHash: event.target.value,
                  }))
                }
                placeholder="0x..."
              />
            </label>
          </div>
          <div className="actions">
            <button onClick={() => void previewDeliver()}>Preview Deliver</button>
            <button onClick={() => void previewDispute()}>Preview Dispute</button>
            <button onClick={() => void previewRefund()}>Preview Refund</button>
            <button onClick={() => void previewResolveToSeller()}>
              Preview Resolve To Seller
            </button>
          </div>
        </section>

        <section className="panel preview-panel">
          <h2>Transaction Preview</h2>
          <pre>{txPreview || "Build a transaction to preview it here."}</pre>
        </section>
      </main>
    </div>
  );
}
