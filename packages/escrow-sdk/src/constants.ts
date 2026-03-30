export const SCRIPT_HASH_LENGTH = 32;
export const U64_LENGTH = 8;
export const U16_LENGTH = 2;
export const ESCROW_DATA_FIXED_LENGTH = 115;

export const ESCROW_STATE_CODES = {
  Funded: 0x00,
  Delivered: 0x01,
  Completed: 0x02,
  Disputed: 0x03,
  Resolved: 0x04,
  Refunded: 0x05,
  Cancelled: 0x06,
} as const;

export const ESCROW_ACTION_CODES = {
  Deliver: 0x01,
  Cancel: 0x02,
  Refund: 0x03,
  Complete: 0x04,
  Dispute: 0x05,
  ResolveToBuyer: 0x06,
  ResolveToSeller: 0x07,
} as const;

export const ESCROW_DESCRIPTION_ENCODING = "utf-8";
