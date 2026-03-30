export class EscrowProtocolError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EscrowProtocolError";
    this.code = code;
  }
}

export function invariant(
  condition: unknown,
  code: string,
  message: string,
): asserts condition {
  if (!condition) {
    throw new EscrowProtocolError(code, message);
  }
}
