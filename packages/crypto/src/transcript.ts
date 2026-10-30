/**
 * Short codes that people compare by eye or read aloud (recovery, pairing).
 * Internal helper: not exported from the package.
 */

export const utf8 = (s: string) => new TextEncoder().encode(s);

/**
 * SHA-256 over a domain-separated, length-prefixed list of fields, so two
 * different contexts or field lists never hash the same bytes.
 */
export async function hashTranscript(
  context: string,
  fields: Uint8Array[],
): Promise<Uint8Array> {
  const parts = [utf8(context), ...fields];
  const buf = new Uint8Array(
    parts.reduce((total, part) => total + 4 + part.length, 0),
  );
  const view = new DataView(buf.buffer);
  let offset = 0;
  for (const part of parts) {
    view.setUint32(offset, part.length);
    buf.set(part, offset + 4);
    offset += 4 + part.length;
  }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

/** 6 decimal digits from the first 4 bytes of a digest. */
export function sixDigitCode(digest: Uint8Array): string {
  const n =
    ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>>
    0;
  return (n % 1_000_000).toString().padStart(6, "0");
}
