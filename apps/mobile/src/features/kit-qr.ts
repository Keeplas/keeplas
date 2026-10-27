import { base64ToUint8, uint8ToBase64 } from "@keeplas/crypto/encoding";

const PREFIX = "keeplas-kit:1:";

export function encodeKitQr(phrase: string[]): string {
  return PREFIX + uint8ToBase64(new TextEncoder().encode(phrase.join(" ")));
}

export function decodeKitQr(text: string): string | null {
  if (!text.startsWith(PREFIX)) return null;
  try {
    const words = new TextDecoder()
      .decode(base64ToUint8(text.slice(PREFIX.length)))
      .split(" ");
    return words.length === 24 && words.every((w) => /^[a-z]+$/.test(w))
      ? words.join(" ")
      : null;
  } catch {
    return null;
  }
}
