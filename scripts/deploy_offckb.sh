#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${NODE_BIN:-/home/ghost/.nvm/versions/node/v22.22.2/bin}"
OFFCKB="PATH=${NODE_BIN}:$PATH npx @offckb/cli"
BUILD_TARGET="${ROOT_DIR}/build/release/escrow-lock"
NETWORK="${CKB_ESCROW_NETWORK:-testnet}"

case "${NETWORK}" in
  testnet)
    PRIVKEY_ENV="OFFCKB_TESTNET_PRIVKEY"
    ;;
  mainnet)
    PRIVKEY_ENV="OFFCKB_MAINNET_PRIVKEY"
    if [[ "${CKB_ESCROW_MAINNET_CONFIRM:-}" != "I_UNDERSTAND_MAINNET_RISK" ]]; then
      echo "Refusing mainnet deployment without explicit confirmation."
      echo "Set both:"
      echo "  export CKB_ESCROW_NETWORK=mainnet"
      echo "  export CKB_ESCROW_MAINNET_CONFIRM=I_UNDERSTAND_MAINNET_RISK"
      exit 1
    fi
    ;;
  *)
    echo "Unsupported CKB_ESCROW_NETWORK: ${NETWORK}"
    echo "Expected: testnet or mainnet"
    exit 1
    ;;
esac

DEPLOYMENT_DIR="${ROOT_DIR}/deployment/${NETWORK}"

if [[ ! -f "${BUILD_TARGET}" ]]; then
  echo "Missing built contract binary at ${BUILD_TARGET}"
  echo "Run: make build CONTRACT=escrow-lock"
  exit 1
fi

if [[ -z "${!PRIVKEY_ENV:-}" ]]; then
  echo "Missing ${PRIVKEY_ENV} environment variable"
  echo "Example:"
  echo "  export ${PRIVKEY_ENV}=0x..."
  exit 1
fi

mkdir -p "${DEPLOYMENT_DIR}"

echo "Deploying ${BUILD_TARGET} to CKB ${NETWORK} via OffCKB..."
eval ${OFFCKB} deploy \
  --network "${NETWORK}" \
  --target "${BUILD_TARGET}" \
  --output "${DEPLOYMENT_DIR}" \
  --privkey "${!PRIVKEY_ENV}" \
  --yes

echo ""
echo "Deployment record written under ${DEPLOYMENT_DIR}"
echo "Next:"
echo "1. Inspect the generated files"
echo "2. Copy the type script code hash / dep out point into the frontend deployment profile"
