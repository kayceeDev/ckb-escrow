import type * as ccc from "@ckb-ccc/ccc";
import type { EscrowCellView } from "@ckb-escrow/sdk";

import type {
  ActionFormState,
  CreateEscrowFormState,
  DeploymentFormState,
  WalletState,
} from "../types.js";

interface OverviewPageProps {
  walletState: WalletState;
  decodedEscrow: EscrowCellView | null;
  status: string;
  lastTxHash: string;
  deployment: DeploymentFormState;
  createForm: CreateEscrowFormState;
  actionForm: ActionFormState;
  onSelectSigner: (signer: ccc.Signer) => void;
  onRefreshWallets: () => void;
}

export function OverviewPage({
  walletState,
  decodedEscrow,
  status,
  lastTxHash,
  deployment,
  createForm,
  actionForm,
  onSelectSigner,
  onRefreshWallets,
}: OverviewPageProps) {
  return (
    <div className="page-grid">
      <section className="panel span-2">
        <div className="panel-head">
          <div>
            <h2>System Snapshot</h2>
            <p className="muted">
              Quick operational view of wallet state, deployment config, and the currently loaded escrow cell.
            </p>
          </div>
          <button className="secondary-button" onClick={onRefreshWallets}>
            Refresh Wallets
          </button>
        </div>
        <div className="stat-grid">
          <article className="stat-card">
            <span>Wallets</span>
            <strong>{walletState.wallets.length}</strong>
          </article>
          <article className="stat-card">
            <span>Active Signer</span>
            <strong>{walletState.activeSigner ? "Selected" : "Missing"}</strong>
          </article>
          <article className="stat-card">
            <span>Deployment Ready</span>
            <strong>{deployment.codeHash && deployment.depTxHash ? "Yes" : "No"}</strong>
          </article>
          <article className="stat-card">
            <span>Loaded Escrow</span>
            <strong>{decodedEscrow ? decodedEscrow.state : "None"}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <h2>Wallets</h2>
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
                      onClick={() => onSelectSigner(signerInfo.signer)}
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
        <h2>Deployment Summary</h2>
        <dl className="decode-grid">
          <div className="wide">
            <dt>Type Script Code Hash</dt>
            <dd>{deployment.codeHash || "Not set"}</dd>
          </div>
          <div>
            <dt>Hash Type</dt>
            <dd>{deployment.hashType}</dd>
          </div>
          <div>
            <dt>Dep Index</dt>
            <dd>{deployment.depIndex}</dd>
          </div>
          <div className="wide">
            <dt>Cell Dep Tx Hash</dt>
            <dd>{deployment.depTxHash || "Not set"}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>Create Defaults</h2>
        <dl className="decode-grid">
          <div>
            <dt>Amount</dt>
            <dd>{createForm.amountShannons}</dd>
          </div>
          <div>
            <dt>Deadline</dt>
            <dd>{createForm.deadlineMs}</dd>
          </div>
          <div className="wide">
            <dt>Description</dt>
            <dd>{createForm.description}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>Escrow Decode</h2>
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
          <p className="empty">Paste escrow data hex in the Operate screen to decode a live escrow cell.</p>
        )}
      </section>

      <section className="panel span-2">
        <h2>Activity</h2>
        <dl className="decode-grid">
          <div className="wide">
            <dt>Status</dt>
            <dd>{status}</dd>
          </div>
          <div className="wide">
            <dt>Last Submitted Transaction</dt>
            <dd>{lastTxHash || "No transaction submitted yet"}</dd>
          </div>
          <div className="wide">
            <dt>Current Escrow Data Hex</dt>
            <dd>{actionForm.escrowDataHex || "0x"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
