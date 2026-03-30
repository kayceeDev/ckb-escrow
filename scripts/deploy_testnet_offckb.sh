#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${NODE_BIN:-/home/ghost/.nvm/versions/node/v22.22.2/bin}"
OFFCKB="PATH=${NODE_BIN}:$PATH npx @offckb/cli"
BUILD_TARGET="${ROOT_DIR}/build/release/escrow-lock"
DEPLOYMENT_DIR="${ROOT_DIR}/deployment/testnet"

if [[ ! -f "${BUILD_TARGET}" ]]; then
  echo "Missing built contract binary at ${BUILD_TARGET}"
  echo "Run: make build CONTRACT=escrow-lock"
  exit 1
fi

if [[ -z "${OFFCKB_TESTNET_PRIVKEY:-}" ]]; then
  echo "Missing OFFCKB_TESTNET_PRIVKEY environment variable"
  echo "Example:"
  echo "  export OFFCKB_TESTNET_PRIVKEY=0x..."
  exit 1
fi

mkdir -p "${DEPLOYMENT_DIR}"

echo "Deploying ${BUILD_TARGET} to CKB testnet via OffCKB..."
eval ${OFFCKB} deploy \
  --network testnet \
  --target "${BUILD_TARGET}" \
  --output "${DEPLOYMENT_DIR}" \
  --privkey "${OFFCKB_TESTNET_PRIVKEY}" \
  --yes

echo ""
echo "Deployment record written under ${DEPLOYMENT_DIR}"
echo "Next:"
echo "1. Inspect the generated files"
echo "2. Copy the type script code hash / dep out point into the frontend deployment profile"
