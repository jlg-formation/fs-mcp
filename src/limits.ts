export const MAX_BYTES = 1024 * 1024;

export class LimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitError";
  }
}

export function assertWithinLimit(bytes: number, label: string): void {
  if (bytes > MAX_BYTES) {
    throw new LimitError(
      `${label} dépasse la limite de ${MAX_BYTES} octets (${bytes} octets)`,
    );
  }
}

// Decoded size of a base64 string, computed without decoding it.
export function base64ByteLength(b64: string): number {
  const clean = b64.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}
