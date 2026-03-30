import {
  ESCROW_ACTION_CODES,
  ESCROW_DATA_FIXED_LENGTH,
  ESCROW_DESCRIPTION_ENCODING,
  ESCROW_STATE_CODES,
  SCRIPT_HASH_LENGTH,
} from "./constants.js";
import { EscrowProtocolError, invariant } from "./errors.js";
import type {
  EscrowAction,
  EscrowCellView,
  EscrowRecord,
  EscrowRecordInput,
  EscrowState,
  EscrowWitnessView,
  Hex,
} from "./types.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder(ESCROW_DESCRIPTION_ENCODING, { fatal: true });

type BytesLike = Hex | Uint8Array | number[];

function normalizeHex(value: Hex): Hex {
  return value.toLowerCase() as Hex;
}

function bytesToHex(bytes: Uint8Array): Hex {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}` as Hex;
}

function hexToBytes(hex: Hex): Uint8Array {
  const normalized = normalizeHex(hex);
  invariant(normalized.startsWith("0x"), "INVALID_HEX", "Hex value must start with 0x");
  invariant(
    (normalized.length - 2) % 2 === 0,
    "INVALID_HEX",
    "Hex value must contain an even number of digits",
  );

  const bytes = new Uint8Array((normalized.length - 2) / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const start = 2 + index * 2;
    const value = normalized.slice(start, start + 2);
    const parsed = Number.parseInt(value, 16);
    invariant(!Number.isNaN(parsed), "INVALID_HEX", `Invalid hex byte: ${value}`);
    bytes[index] = parsed;
  }
  return bytes;
}

function toBytes(input: BytesLike): Uint8Array {
  if (typeof input === "string") {
    return hexToBytes(input);
  }
  return input instanceof Uint8Array ? input : Uint8Array.from(input);
}

function encodeU64(value: bigint): Uint8Array {
  invariant(value >= 0n, "INVALID_U64", "u64 value cannot be negative");
  invariant(value <= 0xffff_ffff_ffff_ffffn, "INVALID_U64", "u64 value exceeds range");

  const bytes = new Uint8Array(8);
  let remaining = value;
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

function decodeU64(bytes: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let index = 0; index < 8; index += 1) {
    value = (value << 8n) + BigInt(bytes[offset + index] ?? 0);
  }
  return value;
}

function encodeU16(value: number): Uint8Array {
  invariant(value >= 0 && value <= 0xffff, "INVALID_U16", "u16 value exceeds range");
  return Uint8Array.from([value >> 8, value & 0xff]);
}

function decodeU16(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function stateFromCode(code: number): EscrowState {
  const entry = Object.entries(ESCROW_STATE_CODES).find(([, candidate]) => candidate === code);
  if (!entry) {
    throw new EscrowProtocolError("INVALID_STATE", `Unknown escrow state code: ${code}`);
  }
  return entry[0] as EscrowState;
}

function actionFromCode(code: number): EscrowAction {
  const entry = Object.entries(ESCROW_ACTION_CODES).find(([, candidate]) => candidate === code);
  if (!entry) {
    throw new EscrowProtocolError("INVALID_ACTION", `Unknown escrow action code: ${code}`);
  }
  return entry[0] as EscrowAction;
}

function codeFromState(state: EscrowState): number {
  return ESCROW_STATE_CODES[state];
}

function codeFromAction(action: EscrowAction): number {
  return ESCROW_ACTION_CODES[action];
}

function assertScriptHashLength(value: Hex, field: string): void {
  const bytes = hexToBytes(value);
  invariant(
    bytes.length === SCRIPT_HASH_LENGTH,
    "INVALID_SCRIPT_HASH",
    `${field} must be exactly 32 bytes`,
  );
}

function normalizeDescription(description: EscrowRecordInput["description"]): Uint8Array {
  return typeof description === "string" ? textEncoder.encode(description) : description;
}

function toBigIntValue(value: bigint | number | string, field: string): bigint {
  try {
    const bigintValue = typeof value === "bigint" ? value : BigInt(value);
    invariant(bigintValue >= 0n, "INVALID_BIGINT", `${field} cannot be negative`);
    return bigintValue;
  } catch (error) {
    throw new EscrowProtocolError(
      "INVALID_BIGINT",
      `${field} must be coercible to bigint: ${String(error)}`,
    );
  }
}

export function createEscrowRecord(input: EscrowRecordInput | EscrowRecord): EscrowRecord {
  assertScriptHashLength(input.buyerLockHash, "buyerLockHash");
  assertScriptHashLength(input.sellerLockHash, "sellerLockHash");
  assertScriptHashLength(input.arbitratorLockHash, "arbitratorLockHash");

  const description = normalizeDescription(input.description);
  invariant(
    description.length <= 0xffff,
    "DESCRIPTION_TOO_LONG",
    "Description must fit within u16 length",
  );

  return {
    buyerLockHash: normalizeHex(input.buyerLockHash),
    sellerLockHash: normalizeHex(input.sellerLockHash),
    arbitratorLockHash: normalizeHex(input.arbitratorLockHash),
    amountShannons: toBigIntValue(input.amountShannons, "amountShannons"),
    deadlineMs: toBigIntValue(input.deadlineMs, "deadlineMs"),
    state: input.state,
    description,
  };
}

export function encodeEscrowData(input: EscrowRecordInput | EscrowRecord): Uint8Array {
  const escrow = createEscrowRecord(input);

  const descriptionLength = escrow.description.length;
  const data = new Uint8Array(ESCROW_DATA_FIXED_LENGTH + descriptionLength);

  let offset = 0;
  data.set(hexToBytes(escrow.buyerLockHash), offset);
  offset += SCRIPT_HASH_LENGTH;
  data.set(hexToBytes(escrow.sellerLockHash), offset);
  offset += SCRIPT_HASH_LENGTH;
  data.set(hexToBytes(escrow.arbitratorLockHash), offset);
  offset += SCRIPT_HASH_LENGTH;
  data.set(encodeU64(escrow.amountShannons), offset);
  offset += 8;
  data.set(encodeU64(escrow.deadlineMs), offset);
  offset += 8;
  data[offset] = codeFromState(escrow.state);
  offset += 1;
  data.set(encodeU16(descriptionLength), offset);
  offset += 2;
  data.set(escrow.description, offset);

  return data;
}

export function encodeEscrowDataHex(input: EscrowRecordInput | EscrowRecord): Hex {
  return bytesToHex(encodeEscrowData(input));
}

export function decodeEscrowData(input: BytesLike): EscrowCellView {
  const bytes = toBytes(input);
  invariant(
    bytes.length >= ESCROW_DATA_FIXED_LENGTH,
    "DATA_TOO_SHORT",
    `Escrow data must be at least ${ESCROW_DATA_FIXED_LENGTH} bytes`,
  );

  const buyerLockHash = bytesToHex(bytes.slice(0, 32));
  const sellerLockHash = bytesToHex(bytes.slice(32, 64));
  const arbitratorLockHash = bytesToHex(bytes.slice(64, 96));
  const amountShannons = decodeU64(bytes, 96);
  const deadlineMs = decodeU64(bytes, 104);
  const state = stateFromCode(bytes[112] ?? 0);
  const descriptionLength = decodeU16(bytes, 113);

  invariant(
    bytes.length >= ESCROW_DATA_FIXED_LENGTH + descriptionLength,
    "INVALID_DESCRIPTION_LENGTH",
    "Description length exceeds available bytes",
  );

  const description = bytes.slice(115, 115 + descriptionLength);

  return {
    buyerLockHash,
    sellerLockHash,
    arbitratorLockHash,
    amountShannons,
    deadlineMs,
    state,
    description,
    descriptionText: textDecoder.decode(description),
    dataHex: bytesToHex(bytes),
  };
}

export function encodeEscrowAction(action: EscrowAction): Uint8Array {
  return Uint8Array.from([codeFromAction(action)]);
}

export function encodeEscrowActionHex(action: EscrowAction): Hex {
  return bytesToHex(encodeEscrowAction(action));
}

export function decodeEscrowAction(input: BytesLike): EscrowWitnessView {
  const bytes = toBytes(input);
  invariant(bytes.length === 1, "INVALID_ACTION_PAYLOAD", "Escrow action payload must be 1 byte");

  const action = actionFromCode(bytes[0] ?? 0);
  return {
    action,
    payloadHex: bytesToHex(bytes),
  };
}
