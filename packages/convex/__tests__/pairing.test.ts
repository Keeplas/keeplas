import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  LOGIN_TOKEN_TTL_MS,
  PAIRING_KEY_MISMATCH,
  PAIRING_TTL_MS,
  pairingKeyHash,
} from "../pairing";
import { sha256Hex } from "../lib/crypto";
import {
  asUser,
  makeT,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// Phase 4 (F6): QR pairing, v2 workflow 8. Pins the state machine
// waiting → approved → consumed, the reject path, the 2-minute expiry, the
// single-use 60 s login token and the key-hash check (M09-3).

const SECRET = "browser-login-secret-0123456789abcdef";
const BROWSER_PK = Buffer.from(new Uint8Array(1184).fill(7)).toString("base64");
const OTHER_PK = Buffer.from(new Uint8Array(1184).fill(9)).toString("base64");

async function createSession(t: TestConvex, browserPublicKey = BROWSER_PK) {
  const { sessionId } = await t.mutation(api.pairing.create, {
    browserPublicKey,
    secretHash: await sha256Hex(SECRET),
    userAgent: "Chrome on macOS",
    _audit: await signedAudit(),
  });
  return sessionId;
}

async function approve(
  t: TestConvex,
  ownerId: Id<"users">,
  sessionId: Id<"pairing_sessions">,
  keyHash?: string,
) {
  await asUser(t, ownerId).mutation(api.pairing.approve, {
    sessionId,
    keyHash: keyHash ?? (await pairingKeyHash(BROWSER_PK)),
    envelope: "sealed-master-key",
    approvalSignature: "ml-dsa-signature",
    _audit: await signedAudit(),
  });
}

function redeem(
  t: TestConvex,
  sessionId: Id<"pairing_sessions">,
  secret = SECRET,
) {
  return t.mutation(internal.pairing.redeemLoginToken, { sessionId, secret });
}

async function readEnvelope(
  t: TestConvex,
  userId: Id<"users">,
  sessionId: Id<"pairing_sessions">,
  secret = SECRET,
) {
  return asUser(t, userId).mutation(api.pairing.readEnvelope, {
    sessionId,
    secret,
    _audit: await signedAudit(),
  });
}

describe("pairing sessions", () => {
  let t: TestConvex;
  let ownerId: Id<"users">;

  beforeEach(async () => {
    vi.useFakeTimers();
    t = makeT();
    ownerId = await seedUser(t);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches the client key-hash vector (@keeplas/crypto pairing)", async () => {
    expect(await pairingKeyHash(BROWSER_PK)).toBe(
      "23d14211db431ee6c40bbd452e048444",
    );
  });

  describe("create", () => {
    it("opens a waiting session that expires after 2 minutes", async () => {
      const sessionId = await createSession(t);
      const row = await t.run((ctx) => ctx.db.get(sessionId));
      expect(row?.status).toBe("waiting");
      expect(row?.expiresAt).toBe(row!.createdAt + PAIRING_TTL_MS);
      expect(row?.approxLocation).toBe("FR");
      expect(await t.query(api.pairing.status, { sessionId })).toBe("waiting");
    });

    it("rejects a key that is not an ML-KEM-768 public key", async () => {
      await expect(
        createSession(t, Buffer.from("short").toString("base64")),
      ).rejects.toThrow("Invalid public key");
    });

    it("stores only the hash of the login secret", async () => {
      const sessionId = await createSession(t);
      const row = await t.run((ctx) => ctx.db.get(sessionId));
      expect(JSON.stringify(row)).not.toContain(SECRET);
    });
  });

  describe("approve", () => {
    it("shows the browser details to the signed-in phone only", async () => {
      const sessionId = await createSession(t);
      await expect(t.query(api.pairing.get, { sessionId })).rejects.toThrow(
        "Not authenticated",
      );
      const details = await asUser(t, ownerId).query(api.pairing.get, {
        sessionId,
      });
      expect(details?.browserPublicKey).toBe(BROWSER_PK);
      expect(details?.userAgent).toBe("Chrome on macOS");
    });

    it("stores the envelope and binds the session to the approver", async () => {
      const sessionId = await createSession(t);
      await approve(t, ownerId, sessionId);
      const row = await t.run((ctx) => ctx.db.get(sessionId));
      expect(row?.status).toBe("approved");
      expect(row?.userId).toBe(ownerId);
      expect(row?.envelope).toBe("sealed-master-key");
      expect(await t.query(api.pairing.status, { sessionId })).toBe("approved");
    });

    it("refuses a key hash that does not match the stored key (M09-3)", async () => {
      const sessionId = await createSession(t);
      await expect(
        approve(t, ownerId, sessionId, await pairingKeyHash(OTHER_PK)),
      ).rejects.toThrow(PAIRING_KEY_MISMATCH);
      const row = await t.run((ctx) => ctx.db.get(sessionId));
      expect(row?.status).toBe("waiting");
      expect(row?.envelope).toBeUndefined();
    });

    it("cannot approve twice", async () => {
      const sessionId = await createSession(t);
      await approve(t, ownerId, sessionId);
      await expect(approve(t, ownerId, sessionId)).rejects.toThrow(
        "Invalid or expired pairing",
      );
    });
  });

  describe("reject", () => {
    it("closes the session and records the reason", async () => {
      const sessionId = await createSession(t);
      await asUser(t, ownerId).mutation(api.pairing.reject, {
        sessionId,
        reason: "key_mismatch",
        _audit: await signedAudit(),
      });
      expect(await t.query(api.pairing.status, { sessionId })).toBe("rejected");
      await expect(approve(t, ownerId, sessionId)).rejects.toThrow(
        "Invalid or expired pairing",
      );
      const log = await t.run((ctx) =>
        ctx.db
          .query("audit_logs")
          .withIndex("by_user", (q) => q.eq("userId", ownerId))
          .first(),
      );
      expect(log?.action).toBe("pairing.session.rejected");
      expect(log?.metadata).toBe(JSON.stringify({ reason: "key_mismatch" }));
    });
  });

  describe("consume", () => {
    it("redeems the login token once for the approver", async () => {
      const sessionId = await createSession(t);
      await approve(t, ownerId, sessionId);
      expect(await redeem(t, sessionId)).toBe(ownerId);
      await expect(redeem(t, sessionId)).rejects.toThrow(
        "Invalid or expired pairing",
      );
    });

    it("refuses a login before approval or with the wrong secret", async () => {
      const sessionId = await createSession(t);
      await expect(redeem(t, sessionId)).rejects.toThrow(
        "Invalid or expired pairing",
      );
      await approve(t, ownerId, sessionId);
      await expect(redeem(t, sessionId, "guessed")).rejects.toThrow(
        "Invalid or expired pairing",
      );
    });

    it("refuses a login token older than 60 seconds", async () => {
      const sessionId = await createSession(t);
      await approve(t, ownerId, sessionId);
      vi.advanceTimersByTime(LOGIN_TOKEN_TTL_MS + 1);
      await expect(redeem(t, sessionId)).rejects.toThrow(
        "Invalid or expired pairing",
      );
    });

    it("serves the envelope once, then wipes it", async () => {
      const sessionId = await createSession(t);
      await approve(t, ownerId, sessionId);
      await redeem(t, sessionId);

      expect(await readEnvelope(t, ownerId, sessionId)).toEqual({
        envelope: "sealed-master-key",
        approvalSignature: "ml-dsa-signature",
      });
      const row = await t.run((ctx) => ctx.db.get(sessionId));
      expect(row?.status).toBe("consumed");
      expect(row?.envelope).toBeUndefined();
      expect(row?.approvalSignature).toBeUndefined();
      await expect(readEnvelope(t, ownerId, sessionId)).rejects.toThrow(
        "Invalid or expired pairing",
      );
    });

    it("refuses the envelope before login, to another user or without the secret", async () => {
      const sessionId = await createSession(t);
      await approve(t, ownerId, sessionId);
      await expect(readEnvelope(t, ownerId, sessionId)).rejects.toThrow(
        "Invalid or expired pairing",
      );
      await redeem(t, sessionId);
      const otherId = await seedUser(t);
      await expect(readEnvelope(t, otherId, sessionId)).rejects.toThrow(
        "Invalid or expired pairing",
      );
      await expect(
        readEnvelope(t, ownerId, sessionId, "guessed"),
      ).rejects.toThrow("Invalid or expired pairing");
    });
  });

  describe("expire", () => {
    it("expires after 2 minutes and the row is purged", async () => {
      const sessionId = await createSession(t);
      await approve(t, ownerId, sessionId);
      vi.advanceTimersByTime(PAIRING_TTL_MS);

      expect(await t.query(api.pairing.status, { sessionId })).toBe("expired");
      await expect(redeem(t, sessionId)).rejects.toThrow(
        "Invalid or expired pairing",
      );

      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await t.run((ctx) => ctx.db.get(sessionId))).toBeNull();
    });

    it("cannot be approved once expired", async () => {
      const sessionId = await createSession(t);
      vi.advanceTimersByTime(PAIRING_TTL_MS);
      await expect(approve(t, ownerId, sessionId)).rejects.toThrow(
        "Invalid or expired pairing",
      );
    });
  });
});
