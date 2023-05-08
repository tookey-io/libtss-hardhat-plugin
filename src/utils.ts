import BN from "bn.js";

export function toNumber(
  value: BN | Buffer | bigint | undefined
): number | undefined {
  if (typeof value === 'undefined')
    return undefined

  if (value instanceof BN) {
    return value.toNumber()
  }

  if (value instanceof Buffer) {
    throw new Error("incorrect type (buffer)")
  }

  return Number(value);
}

export function toHexString(
  value: BN | Buffer | bigint | undefined
): string | undefined {
  if (typeof value === "undefined") {
    return;
  }

  if (typeof value === "bigint") {
    return `0x${value.toString(16)}`;
  }
  
  return `0x${value.toString("hex")}`;
}
