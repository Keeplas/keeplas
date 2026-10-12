import { describe, expect, it } from "vitest";
import {
  buildPairingQr,
  generateBrowserPairingKeys,
  openPairingEnvelope,
  pairingKeyHash,
  parsePairingQr,
  sealPairingEnvelope,
} from "@keeplas/crypto/pairing";
import { generateIdentityKeyPair } from "@keeplas/crypto/sig";
import { api, internal } from "../_generated/api";
import { asUser, makeT, signedAudit } from "./test.helpers";

// Phase 4 (F6) end to end: real crypto on both sides, real Convex functions in
// between. The browser ends up with the phone's MasterKey; Convex only ever
// stores ciphertext and hashes.

const ORIGIN = "https://app.keeplas.com";

describe("QR link, browser ↔ Convex ↔ phone", () => {
  it("hands the MasterKey to the browser", async () => {
    const t = makeT();
    const identity = generateIdentityKeyPair();
    const ownerId = await t.run((ctx) =>
      ctx.db.insert("users", { identityPublicKey: identity.publicKey }),
    );
    const masterKey = crypto.getRandomValues(new Uint8Array(32));

    // Browser: keys, session, QR.
    const browser = await generateBrowserPairingKeys();
    const { sessionId } = await t.mutation(api.pairing.create, {
      browserPublicKey: browser.publicKey,
      secretHash: browser.loginSecretHash,
      userAgent: "Chrome on macOS",
      _audit: await signedAudit(),
    });
    const qrText = buildPairingQr({
      sessionId,
      keyHash: await pairingKeyHash(browser.publicKey),
      origin: ORIGIN,
    });

    // Phone: scan, check the key hash, seal, approve.
    const qr = parsePairingQr(qrText)!;
    const phone = asUser(t, ownerId);
    const details = await phone.query(api.pairing.get, {
      sessionId: qr.sessionId as typeof sessionId,
    });
    expect(await pairingKeyHash(details!.browserPublicKey)).toBe(qr.keyHash);
    const sealed = await sealPairingEnvelope({
      masterKey,
      userId: ownerId,
      browserPublicKey: details!.browserPublicKey,
      sessionId: qr.sessionId,
      origin: qr.origin,
      identitySecretKey: identity.secretKey,
    });
    await phone.mutation(api.pairing.approve, {
      sessionId,
      keyHash: qr.keyHash,
      ...sealed,
      _audit: await signedAudit(),
    });

    // Browser: sign in with its secret, read the envelope once, open it.
    const userId = await t.mutation(internal.pairing.redeemLoginToken, {
      sessionId,
      secret: browser.loginSecret,
    });
    expect(userId).toBe(ownerId);
    const { envelope, approvalSignature } = await asUser(t, userId).mutation(
      api.pairing.readEnvelope,
      { sessionId, secret: browser.loginSecret, _audit: await signedAudit() },
    );
    const received = await openPairingEnvelope({
      envelope,
      approvalSignature,
      secretKey: browser.secretKey,
      sessionId,
      origin: ORIGIN,
      identityPublicKey: identity.publicKey,
      userId,
    });
    expect(received).toEqual(masterKey);

    // Nothing usable is left on the server.
    const row = await t.run((ctx) => ctx.db.get(sessionId));
    expect(row?.envelope).toBeUndefined();
    expect(JSON.stringify(row)).not.toContain(browser.loginSecret);
  });
});
