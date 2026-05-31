import { describe, it, expect } from "vitest";
import { verifyStripeSignature } from "../lib/stripe_webhook";

// The Stripe webhook route trusts the request body only after this HMAC check
// (mirrors stripe.webhooks.constructEvent). It must accept Stripe's own
// signature, and reject a tampered body, a wrong secret, a stale timestamp, and
// a missing header.

const SECRET = "whsec_test_secret";

async function sign(
  payload: string,
  secret: string,
  ts: number,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${ts}.${payload}`),
  );
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${ts},v1=${hex}`;
}

describe("verifyStripeSignature", () => {
  const body = JSON.stringify({
    type: "checkout.session.completed",
    id: "evt",
  });
  const now = () => Math.floor(Date.now() / 1000);

  it("accepts a valid, fresh signature", async () => {
    const header = await sign(body, SECRET, now());
    expect(await verifyStripeSignature(body, header, SECRET)).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const header = await sign(body, SECRET, now());
    expect(await verifyStripeSignature(body + "tampered", header, SECRET)).toBe(
      false,
    );
  });

  it("rejects a signature made with the wrong secret", async () => {
    const header = await sign(body, "whsec_other", now());
    expect(await verifyStripeSignature(body, header, SECRET)).toBe(false);
  });

  it("rejects a stale timestamp beyond tolerance", async () => {
    const header = await sign(body, SECRET, now() - 10_000);
    expect(await verifyStripeSignature(body, header, SECRET)).toBe(false);
  });

  it("rejects a missing signature header", async () => {
    expect(await verifyStripeSignature(body, null, SECRET)).toBe(false);
  });
});
