import { describe, it, expect } from "vitest";
import "./test.helpers"; // sets KEEPLAS_CTX_SECRET
import {
  signLifeCheckToken,
  verifyLifeCheckToken,
} from "../lib/life_check_token";
import { verifyAuditContext } from "../audit";

// Findings 35 / 51: the Life Check email token and the audit-context seal
// both use KEEPLAS_CTX_SECRET. They must not be interchangeable: a token's
// signature must never pass as a server-attested `_audit` envelope.

const DAY_MS = 24 * 60 * 60 * 1000;
const enc = new TextEncoder();

function b64urlToB64(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return b64 + "=".repeat((4 - (b64.length % 4)) % 4);
}

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** A token in the pre-v2 format: HMAC under the raw secret, no version. */
async function legacyToken(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(process.env.KEEPLAS_CTX_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(body)),
  );
  return `${b64url(enc.encode(body))}.${b64url(sig)}`;
}

describe("Life Check token", () => {
  it("round-trips a freshly issued token", async () => {
    const exp = Date.now() + 10 * DAY_MS;
    const token = await signLifeCheckToken({
      cycleId: "cycle1",
      userId: "user1",
      exp,
    });

    expect(await verifyLifeCheckToken(token)).toEqual({
      cycleId: "cycle1",
      userId: "user1",
      exp,
    });
  });

  it("still accepts a link issued before the format change", async () => {
    const exp = Date.now() + DAY_MS;
    const token = await legacyToken(`cycle1|user1|${exp}`);

    expect(await verifyLifeCheckToken(token)).toEqual({
      cycleId: "cycle1",
      userId: "user1",
      exp,
    });
  });

  it("rejects an expired token", async () => {
    const token = await signLifeCheckToken({
      cycleId: "cycle1",
      userId: "user1",
      exp: Date.now() - 1000,
    });

    expect(await verifyLifeCheckToken(token)).toBeNull();
  });

  it("is not usable as an audit-context seal (domain separation)", async () => {
    // Shape the payload like a seal on purpose: before, the signature over
    // `ip|country|ts` was the same bytes under the same key.
    const exp = Date.now();
    const token = await signLifeCheckToken({
      cycleId: "203.0.113.7",
      userId: "FR",
      exp,
    });
    const sig = b64urlToB64(token.split(".").at(-1)!);

    await expect(
      verifyAuditContext({ ip: "203.0.113.7", country: "FR", ts: exp, sig }),
    ).rejects.toThrow();
  });
});

describe("verifyAuditContext shape checks", () => {
  it("rejects a country that is not a 2-letter code, even when signed", async () => {
    // A pre-v2 Life Check link re-read as {ip: cycleId, country: userId}.
    const ts = Date.now();
    const token = await legacyToken(
      `cycle1|k57userid0000000000000000000|${ts}`,
    );
    const sig = b64urlToB64(token.split(".")[1]);

    await expect(
      verifyAuditContext({
        ip: "cycle1",
        country: "k57userid0000000000000000000",
        ts,
        sig,
      }),
    ).rejects.toThrow();
  });
});
