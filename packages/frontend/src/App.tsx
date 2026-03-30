import * as ccc from "@ckb-ccc/ccc";
import { EscrowService } from "@ckb-escrow/app";
import { decodeEscrowData, type EscrowCellView } from "@ckb-escrow/sdk";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import type {
  ActionFormState,
  CreateEscrowFormState,
  DeploymentFormState,
  WalletState,
} from "./types.js";

const testnetClient = new ccc.ClientPublicTestnet();

const STORAGE_KEYS = {
  deployment: "ckb-escrow:deployment",
  create: "ckb-escrow:create",
  action: "ckb-escrow:action",
} as const;

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

function loadStoredState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

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

type AsyncAction = () => Promise<ccc.Transaction | ccc.Hex>;

function prettyJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_, nested) => (typeof nested === "bigint" ? nested.toString() : nested),
    2,
  );
}

export function App() {
  const [walletState, setWalletState] = useState<WalletState>({
    wallets: [],
    activeSigner: null,
  });
  const [deployment, setDeployment] = useState<DeploymentFormState>(() =>
    loadStoredState(STORAGE_KEYS.deployment, initialDeployment),
  );
  const [createForm, setCreateForm] = useState<CreateEscrowFormState>(() =>
    loadStoredState(STORAGE_KEYS.create, initialCreateForm),
  );
  const [actionForm, setActionForm] = useState<ActionFormState>(() =>
    loadStoredState(STORAGE_KEYS.action, initialActionForm),
  );
  const [txPreview, setTxPreview] = useState<string>("");
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const [status, setStatus] = useState<string>("Idle");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const controllerRef = useRef<ccc.SignersController | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.deployment, JSON.stringify(deployment));
  }, [deployment]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.create, JSON.stringify(createForm));
  }, [createForm]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.action, JSON.stringify(actionForm));
  }, [actionForm]);

  useEffect(() => {
    const controller = new ccc.SignersController();
    controllerRef.current = controller;

    async function refreshWallets() {
      setStatus("Refreshing wallets...");
      await controller.refresh(testnetClient, (wallets) => {
        setWalletState((current) => ({
          wallets,
          activeSigner:
            current.activeSigner &&
            wallets.some((wallet) =>
              wallet.signers.some((signerInfo) => signerInfo.signer === current.activeSigner),
            )
              ? current.activeSigner
              : null,
        }));
      });
      setStatus("Wallet discovery finished.");
    }

    void refreshWallets();

    return () => controller.disconnect();
  }, []);

  const decodedEscrow = useMemo<EscrowCellView | null>(() => {
    try {
      if (!actionForm.escrowDataHex || actionForm.escrowDataHex === "0x") {
        return null;
      }
      return decodeEscrowData(actionForm.escrowDataHex as `0x${string}`);
    } catch {
      return null;
    }
  }, [actionForm.escrowDataHex]);

  const service = walletState.activeSigner
    ? new EscrowService({
        deployment: {
          typeScript: makeTypeScript(deployment),
          cellDep: makeCellDep(deployment),
        },
        signer: walletState.activeSigner,
      })
    : null;

  function updateDeployment<K extends keyof DeploymentFormState>(
    key: K,
    value: DeploymentFormState[K],
  ) {
    setDeployment((current) => ({ ...current, [key]: value }));
  }

  function updateCreateForm<K extends keyof CreateEscrowFormState>(
    key: K,
    value: CreateEscrowFormState[K],
  ) {
    setCreateForm((current) => ({ ...current, [key]: value }));
  }

  function updateActionForm<K extends keyof ActionFormState>(
    key: K,
    value: ActionFormState[K],
  ) {
    setActionForm((current) => ({ ...current, [key]: value }));
  }

  async function runAction(label: string, action: AsyncAction) {
    try {
      setBusyAction(label);
      setStatus(`${label} in progress...`);
      const result = await action();

      if (typeof result === "string") {
        setLastTxHash(result);
        setTxPreview("");
        setStatus(`${label} submitted.`);
      } else {
        setTxPreview(prettyJson(result));
        setLastTxHash("");
        setStatus(`${label} prepared.`);
      }
    } catch (error) {
      setStatus(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function previewCreate() {
    if (!service) {
      setStatus("Select a signer before building transactions.");
      return;
    }

    await runAction("Create preview", async () =>
      service.buildCreateEscrow({
        sellerLock: makeLock(createForm.sellerCodeHash, createForm.sellerArgs),
        arbitratorLock: makeLock(
          createForm.arbitratorCodeHash,
          createForm.arbitratorArgs,
        ),
        escrowLock: makeLock(createForm.escrowCodeHash, createForm.escrowArgs),
        amountShannons: BigInt(createForm.amountShannons),
        deadlineMs: BigInt(createForm.deadlineMs),
        description: createForm.description,
      }),
    );
  }

  async function sendCreate() {
    if (!service) {
      setStatus("Select a signer before sending transactions.");
      return;
    }

    await runAction("Create send", async () =>
      service.sendCreateEscrow({
        sellerLock: makeLock(createForm.sellerCodeHash, createForm.sellerArgs),
        arbitratorLock: makeLock(
          createForm.arbitratorCodeHash,
          createForm.arbitratorArgs,
        ),
        escrowLock: makeLock(createForm.escrowCodeHash, createForm.escrowArgs),
        amountShannons: BigInt(createForm.amountShannons),
        deadlineMs: BigInt(createForm.deadlineMs),
        description: createForm.description,
      }),
    );
  }

  async function previewDeliver() {
    if (!service) {
      setStatus("Select a signer before building transactions.");
      return;
    }

    await runAction("Deliver preview", async () =>
      service.buildDeliver(makeEscrowCell(actionForm, deployment)),
    );
  }

  async function sendDeliver() {
    if (!service) {
      setStatus("Select a signer before sending transactions.");
      return;
    }

    await runAction("Deliver send", async () =>
      service.sendDeliver(makeEscrowCell(actionForm, deployment)),
    );
  }

  async function previewDispute() {
    if (!service) {
      setStatus("Select a signer before building transactions.");
      return;
    }

    await runAction("Dispute preview", async () =>
      service.buildDispute(makeEscrowCell(actionForm, deployment)),
    );
  }

  async function sendDispute() {
    if (!service) {
      setStatus("Select a signer before sending transactions.");
      return;
    }

    await runAction("Dispute send", async () =>
      service.sendDispute(makeEscrowCell(actionForm, deployment)),
    );
  }

  async function previewRefund() {
    if (!service) {
      setStatus("Select a signer before building transactions.");
      return;
    }

    await runAction("Refund preview", async () =>
      service.buildRefund({
        escrowInput: makeEscrowCell(actionForm, deployment),
        referenceTimestampMs: BigInt(actionForm.referenceTimestampMs || "0"),
        headerDeps: actionForm.headerDepHash ? [actionForm.headerDepHash] : [],
      }),
    );
  }

  async function sendRefund() {
    if (!service) {
      setStatus("Select a signer before sending transactions.");
      return;
    }

    await runAction("Refund send", async () =>
      service.sendRefund({
        escrowInput: makeEscrowCell(actionForm, deployment),
        referenceTimestampMs: BigInt(actionForm.referenceTimestampMs || "0"),
        headerDeps: actionForm.headerDepHash ? [actionForm.headerDepHash] : [],
      }),
    );
  }

  async function previewResolveToSeller() {
    if (!service) {
      setStatus("Select a signer before building transactions.");
      return;
    }

    await runAction("Resolve preview", async () =>
      service.buildResolveToSeller({
        escrowInput: makeEscrowCell(actionForm, deployment),
        recipientLock: makeLock(actionForm.recipientCodeHash, actionForm.recipientArgs),
      }),
    );
  }

  async function sendResolveToSeller() {
    if (!service) {
      setStatus("Select a signer before sending transactions.");
      return;
    }

    await runAction("Resolve send", async () =>
      service.sendResolveToSeller({
        escrowInput: makeEscrowCell(actionForm, deployment),
        recipientLock: makeLock(actionForm.recipientCodeHash, actionForm.recipientArgs),
      }),
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">CKB Escrow Studio</p>
          <h1>Escrow flows prepared, signed, and sent from one workspace.</h1>
          <p className="lede">
            We now have a protocol layer, CCC adapter, app service, and a frontend shell that can
            prepare and submit escrow actions. This screen is intentionally operational, not just decorative.
          </p>
        </div>
        <div className="status-card">
          <span className="status-label">Status</span>
          <strong>{status}</strong>
          {lastTxHash ? (
            <code className="tx-hash">{lastTxHash}</code>
          ) : null}
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Wallets</h2>
              <p className="muted">Discovered through CCC signers controller on CKB testnet.</p>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                controllerRef.current?.disconnect();
                void controllerRef.current?.refresh(testnetClient, (wallets) => {
                  setWalletState((current) => ({
                    wallets,
                    activeSigner: current.activeSigner,
                  }));
                });
                setStatus("Wallet refresh requested.");
              }}
            >
              Refresh
            </button>
          </div>
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
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateDeployment("codeHash", event.target.value)
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Hash Type</span>
              <select
                value={deployment.hashType}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  updateDeployment("hashType", event.target.value as "type" | "data")
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
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateDeployment("args", event.target.value)
                }
                placeholder="0x"
              />
            </label>
            <label>
              <span>Cell Dep Tx Hash</span>
              <input
                value={deployment.depTxHash}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateDeployment("depTxHash", event.target.value)
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Cell Dep Index</span>
              <input
                value={deployment.depIndex}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateDeployment("depIndex", event.target.value)
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
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateCreateForm("sellerCodeHash", event.target.value)
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Seller Args</span>
              <input
                value={createForm.sellerArgs}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateCreateForm("sellerArgs", event.target.value)
                }
              />
            </label>
            <label>
              <span>Arbitrator Lock Code Hash</span>
              <input
                value={createForm.arbitratorCodeHash}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateCreateForm("arbitratorCodeHash", event.target.value)
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Arbitrator Args</span>
              <input
                value={createForm.arbitratorArgs}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateCreateForm("arbitratorArgs", event.target.value)
                }
              />
            </label>
            <label>
              <span>Escrow Lock Code Hash</span>
              <input
                value={createForm.escrowCodeHash}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateCreateForm("escrowCodeHash", event.target.value)
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Escrow Args</span>
              <input
                value={createForm.escrowArgs}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateCreateForm("escrowArgs", event.target.value)
                }
              />
            </label>
            <label>
              <span>Amount (shannons)</span>
              <input
                value={createForm.amountShannons}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateCreateForm("amountShannons", event.target.value)
                }
              />
            </label>
            <label>
              <span>Deadline (ms)</span>
              <input
                value={createForm.deadlineMs}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateCreateForm("deadlineMs", event.target.value)
                }
              />
            </label>
            <label className="wide">
              <span>Description</span>
              <input
                value={createForm.description}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateCreateForm("description", event.target.value)
                }
              />
            </label>
          </div>
          <div className="actions">
            <button onClick={() => void previewCreate()} disabled={busyAction !== null}>
              Preview Create
            </button>
            <button onClick={() => void sendCreate()} disabled={busyAction !== null}>
              Send Create
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>Escrow Actions</h2>
          <div className="form-grid">
            <label>
              <span>Escrow Tx Hash</span>
              <input
                value={actionForm.escrowTxHash}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateActionForm("escrowTxHash", event.target.value)
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Escrow Index</span>
              <input
                value={actionForm.escrowIndex}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateActionForm("escrowIndex", event.target.value)
                }
              />
            </label>
            <label>
              <span>Escrow Capacity</span>
              <input
                value={actionForm.escrowCapacity}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateActionForm("escrowCapacity", event.target.value)
                }
              />
            </label>
            <label>
              <span>Escrow Lock Code Hash</span>
              <input
                value={actionForm.escrowLockCodeHash}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateActionForm("escrowLockCodeHash", event.target.value)
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Escrow Lock Args</span>
              <input
                value={actionForm.escrowLockArgs}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateActionForm("escrowLockArgs", event.target.value)
                }
              />
            </label>
            <label className="wide">
              <span>Escrow Data Hex</span>
              <textarea
                value={actionForm.escrowDataHex}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  updateActionForm("escrowDataHex", event.target.value)
                }
              />
            </label>
            <label>
              <span>Recipient Code Hash</span>
              <input
                value={actionForm.recipientCodeHash}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateActionForm("recipientCodeHash", event.target.value)
                }
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Recipient Args</span>
              <input
                value={actionForm.recipientArgs}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateActionForm("recipientArgs", event.target.value)
                }
              />
            </label>
            <label>
              <span>Reference Timestamp (refund)</span>
              <input
                value={actionForm.referenceTimestampMs}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateActionForm("referenceTimestampMs", event.target.value)
                }
              />
            </label>
            <label>
              <span>Header Dep Hash (refund)</span>
              <input
                value={actionForm.headerDepHash}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  updateActionForm("headerDepHash", event.target.value)
                }
                placeholder="0x..."
              />
            </label>
          </div>
          <div className="actions">
            <button onClick={() => void previewDeliver()} disabled={busyAction !== null}>
              Preview Deliver
            </button>
            <button onClick={() => void sendDeliver()} disabled={busyAction !== null}>
              Send Deliver
            </button>
            <button onClick={() => void previewDispute()} disabled={busyAction !== null}>
              Preview Dispute
            </button>
            <button onClick={() => void sendDispute()} disabled={busyAction !== null}>
              Send Dispute
            </button>
            <button onClick={() => void previewRefund()} disabled={busyAction !== null}>
              Preview Refund
            </button>
            <button onClick={() => void sendRefund()} disabled={busyAction !== null}>
              Send Refund
            </button>
            <button onClick={() => void previewResolveToSeller()} disabled={busyAction !== null}>
              Preview Resolve To Seller
            </button>
            <button onClick={() => void sendResolveToSeller()} disabled={busyAction !== null}>
              Send Resolve To Seller
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>Decoded Escrow</h2>
          {decodedEscrow ? (
            <dl className="decode-grid">
              <div>
                <dt>State</dt>
                <dd>{decodedEscrow.state}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{decodedEscrow.amountShannons.toString()}</dd>
              </div>
              <div>
                <dt>Deadline</dt>
                <dd>{decodedEscrow.deadlineMs.toString()}</dd>
              </div>
              <div className="wide">
                <dt>Description</dt>
                <dd>{decodedEscrow.descriptionText}</dd>
              </div>
              <div className="wide">
                <dt>Buyer Lock Hash</dt>
                <dd>{decodedEscrow.buyerLockHash}</dd>
              </div>
              <div className="wide">
                <dt>Seller Lock Hash</dt>
                <dd>{decodedEscrow.sellerLockHash}</dd>
              </div>
              <div className="wide">
                <dt>Arbitrator Lock Hash</dt>
                <dd>{decodedEscrow.arbitratorLockHash}</dd>
              </div>
            </dl>
          ) : (
            <p className="empty">Paste escrow data hex to see the decoded cell view.</p>
          )}
        </section>

        <section className="panel preview-panel">
          <h2>Transaction Preview</h2>
          <pre>{txPreview || "Build or send a transaction to inspect it here."}</pre>
        </section>
      </main>
    </div>
  );
}
