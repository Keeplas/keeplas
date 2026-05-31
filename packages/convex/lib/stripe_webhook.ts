import { constantTimeStringEquals } from "./crypto";

/**
 * Verify a Stripe webhook signature without the `stripe` SDK, mirroring the
 * scheme documented at https://stripe.com/docs/webhooks/signatures.
 *
 * The `Stripe-Signature` header looks like:
 *   t=1690000000,v1=hexdigest,v1=anotherdigest
 * We recompute `HMAC-SHA256(secret, `${t}.${rawBody}`)` and compare its hex
 * digest, constant-time, against each provided `v1` scheme. The signed payload
 * MUST be the exact raw request body — parse JSON only after this passes.
 *
 * Returns true when the signature is valid AND the timestamp is within
 * `toleranceSec` of now (replay protection); false otherwise.
 */
export async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  if (!sigHeader) return false;

  let timestamp: string | null = null;
  const v1Signatures: string[] = [];
  for (const part of sigHeader.split(",")) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    else if (key === "v1" && value) v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const ageSec = Math.abs(Date.now() / 1000 - ts);
  if (ageSec > toleranceSec) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${timestamp}.${rawBody}`),
  );
  const expected = bytesToHex(new Uint8Array(sigBuf));

  return v1Signatures.some((sig) => constantTimeStringEquals(sig, expected));
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
