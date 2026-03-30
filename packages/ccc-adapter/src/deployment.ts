import * as ccc from "@ckb-ccc/ccc";

import type { EscrowDeployment } from "./types.js";

export function getEscrowTypeScript(deployment: EscrowDeployment): ccc.Script {
  return ccc.Script.from(deployment.typeScript);
}

export function getEscrowCellDep(deployment: EscrowDeployment): ccc.CellDep {
  return ccc.CellDep.from(deployment.cellDep);
}

export function applyEscrowDeployment(
  tx: ccc.Transaction,
  deployment: EscrowDeployment,
): ccc.Transaction {
  const cellDep = getEscrowCellDep(deployment);
  const exists = tx.cellDeps.some((dep) => dep.eq(cellDep));
  if (!exists) {
    tx.cellDeps.push(cellDep);
  }
  return tx;
}
