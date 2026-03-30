import * as ccc from "@ckb-ccc/ccc";
import { EscrowService } from "@ckb-escrow/app";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";

import {
  STORAGE_KEYS,
  initialActionForm,
  initialCreateForm,
  initialDeployment,
  loadStoredState,
  makeCellDep,
  makeEscrowCell,
  makeLock,
  makeTypeScript,
  prettyJson,
  routeFromHash,
  ROUTE_LABELS,
  testnetClient,
  type RouteId,
  decodeEscrowHex,
} from "./studio.js";
import type {
  ActionFormState,
  CreateEscrowFormState,
  DeploymentFormState,
  WalletState,
} from "./types.js";

const OverviewPage = lazy(async () =>
  import("./pages/index.js").then((module) => ({ default: module.OverviewPage })),
);
const CreatePage = lazy(async () =>
  import("./pages/index.js").then((module) => ({ default: module.CreatePage })),
);
const ActionsPage = lazy(async () =>
  import("./pages/index.js").then((module) => ({ default: module.ActionsPage })),
);

type AsyncAction = () => Promise<ccc.Transaction | ccc.Hex>;

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
  const [route, setRoute] = useState<RouteId>(() => routeFromHash(window.location.hash));
  const controllerRef = useRef<ccc.SignersController | null>(null);

  useEffect(() => {
    function onHashChange() {
      setRoute(routeFromHash(window.location.hash));
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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

  const decodedEscrow = useMemo(() => decodeEscrowHex(actionForm.escrowDataHex), [actionForm.escrowDataHex]);

  const service = walletState.activeSigner
    ? new EscrowService({
        deployment: {
          typeScript: makeTypeScript(deployment),
          cellDep: makeCellDep(deployment),
        },
        signer: walletState.activeSigner,
      })
    : null;

  async function refreshWallets() {
    if (!controllerRef.current) {
      return;
    }

    setStatus("Refreshing wallets...");
    controllerRef.current.disconnect();
    await controllerRef.current.refresh(testnetClient, (wallets) => {
      setWalletState((current) => ({
        wallets,
        activeSigner: current.activeSigner,
      }));
    });
    setStatus("Wallet refresh finished.");
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

  const pageProps = {
    createForm,
    actionForm,
    busy: busyAction !== null,
    decodedEscrow,
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">CKB Escrow Studio</p>
          <h1>Escrow flows prepared, signed, decoded, and operated like an actual product.</h1>
          <p className="lede">
            We are now moving from one giant workbench into an application shell. The protocol and CCC layers stay the same; the frontend becomes easier to navigate and extend.
          </p>
        </div>
        <div className="status-card">
          <span className="status-label">Status</span>
          <strong>{status}</strong>
          {lastTxHash ? <code className="tx-hash">{lastTxHash}</code> : null}
        </div>
      </header>

      <nav className="route-nav">
        {(Object.entries(ROUTE_LABELS) as [RouteId, string][]).map(([routeId, label]) => (
          <a
            key={routeId}
            href={`#/${routeId}`}
            className={route === routeId ? "route-link active" : "route-link"}
          >
            {label}
          </a>
        ))}
      </nav>

      <Suspense fallback={<section className="panel"><p className="muted">Loading screen...</p></section>}>
        {route === "overview" ? (
          <OverviewPage
            walletState={walletState}
            decodedEscrow={decodedEscrow}
            status={status}
            lastTxHash={lastTxHash}
            deployment={deployment}
            createForm={createForm}
            actionForm={actionForm}
            onSelectSigner={(signer) =>
              setWalletState((current) => ({ ...current, activeSigner: signer }))
            }
            onRefreshWallets={() => void refreshWallets()}
          />
        ) : null}

        {route === "create" ? (
          <CreatePage
            {...pageProps}
            onUpdate={(key, value) =>
              setCreateForm((current) => ({ ...current, [key]: value }))
            }
            onPreview={() => {
              if (!service) {
                setStatus("Select a signer before building transactions.");
                return;
              }

              void runAction("Create preview", async () =>
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
            }}
            onSend={() => {
              if (!service) {
                setStatus("Select a signer before sending transactions.");
                return;
              }

              void runAction("Create send", async () =>
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
            }}
          />
        ) : null}

        {route === "actions" ? (
          <ActionsPage
            {...pageProps}
            onUpdate={(key, value) =>
              setActionForm((current) => ({ ...current, [key]: value }))
            }
            onPreviewDeliver={() => {
              if (!service) {
                setStatus("Select a signer before building transactions.");
                return;
              }
              void runAction("Deliver preview", async () =>
                service.buildDeliver(makeEscrowCell(actionForm, deployment)),
              );
            }}
            onSendDeliver={() => {
              if (!service) {
                setStatus("Select a signer before sending transactions.");
                return;
              }
              void runAction("Deliver send", async () =>
                service.sendDeliver(makeEscrowCell(actionForm, deployment)),
              );
            }}
            onPreviewDispute={() => {
              if (!service) {
                setStatus("Select a signer before building transactions.");
                return;
              }
              void runAction("Dispute preview", async () =>
                service.buildDispute(makeEscrowCell(actionForm, deployment)),
              );
            }}
            onSendDispute={() => {
              if (!service) {
                setStatus("Select a signer before sending transactions.");
                return;
              }
              void runAction("Dispute send", async () =>
                service.sendDispute(makeEscrowCell(actionForm, deployment)),
              );
            }}
            onPreviewRefund={() => {
              if (!service) {
                setStatus("Select a signer before building transactions.");
                return;
              }
              void runAction("Refund preview", async () =>
                service.buildRefund({
                  escrowInput: makeEscrowCell(actionForm, deployment),
                  referenceTimestampMs: BigInt(actionForm.referenceTimestampMs || "0"),
                  headerDeps: actionForm.headerDepHash ? [actionForm.headerDepHash] : [],
                }),
              );
            }}
            onSendRefund={() => {
              if (!service) {
                setStatus("Select a signer before sending transactions.");
                return;
              }
              void runAction("Refund send", async () =>
                service.sendRefund({
                  escrowInput: makeEscrowCell(actionForm, deployment),
                  referenceTimestampMs: BigInt(actionForm.referenceTimestampMs || "0"),
                  headerDeps: actionForm.headerDepHash ? [actionForm.headerDepHash] : [],
                }),
              );
            }}
            onPreviewResolveToSeller={() => {
              if (!service) {
                setStatus("Select a signer before building transactions.");
                return;
              }
              void runAction("Resolve preview", async () =>
                service.buildResolveToSeller({
                  escrowInput: makeEscrowCell(actionForm, deployment),
                  recipientLock: makeLock(
                    actionForm.recipientCodeHash,
                    actionForm.recipientArgs,
                  ),
                }),
              );
            }}
            onSendResolveToSeller={() => {
              if (!service) {
                setStatus("Select a signer before sending transactions.");
                return;
              }
              void runAction("Resolve send", async () =>
                service.sendResolveToSeller({
                  escrowInput: makeEscrowCell(actionForm, deployment),
                  recipientLock: makeLock(
                    actionForm.recipientCodeHash,
                    actionForm.recipientArgs,
                  ),
                }),
              );
            }}
          />
        ) : null}
      </Suspense>

      <section className="panel preview-panel">
        <h2>Transaction Preview</h2>
        <pre>{txPreview || "Build or send a transaction to inspect it here."}</pre>
      </section>
    </div>
  );
}
