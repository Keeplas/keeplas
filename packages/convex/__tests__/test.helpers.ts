import { convexTest } from "convex-test";
import schema from "../schema";
import { storeBlob, type StorageRef } from "../lib/storage";
import type { Id } from "../_generated/dataModel";

// `auditedMutation` re-verifies an HMAC-signed audit envelope before running
// the handler (see audit.ts). Set the secret the verifier reads so test calls
// through audited mutations pass. Value just needs to be ≥16 chars.
process.env.KEEPLAS_CTX_SECRET ??= "test-keeplas-ctx-secret-0123456789";

// Glob every Convex module so convex-test can resolve function references.
// The module-root prefix is auto-detected from the `_generated` directory, so
// the leading `../` (tests live in __tests__/) is fine.
const modules = import.meta.glob("../**/*.*s");

export type TestConvex = ReturnType<typeof convexTest>;

export function makeT(): TestConvex {
  return convexTest(schema, modules);
}

/** Insert a bare user (all user fields are optional) and return its id. */
export async function seedUser(t: TestConvex): Promise<Id<"users">> {
  return await t.run((ctx) => ctx.db.insert("users", {}));
}

/** Mint a real storage handle for fixtures, routed through the wrapper. */
export async function seedStorageRef(
  t: TestConvex,
  bytes = 1,
): Promise<StorageRef> {
  return await t.run((ctx) =>
    storeBlob(ctx.storage, new Blob([new Uint8Array(bytes)])),
  );
}

/** Act as the given user — `getAuthUserId` reads `subject.split("|")[0]`. */
export function asUser(t: TestConvex, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|test-session` });
}

/**
 * Act as a given user on a SPECIFIC session id — `getAuthSessionId` reads
 * `subject.split("|")[1]`. Used by the step-up gate tests where the cleared
 * `auth_session_login_otp` / `auth_session_totp` rows are keyed by that
 * session id.
 */
export function asUserSession(
  t: TestConvex,
  userId: Id<"users">,
  sessionId: Id<"authSessions">,
) {
  return t.withIdentity({ subject: `${userId}|${sessionId}` });
}

/**
 * Seed a real `authSessions` row so the test has a concrete
 * `Id<"authSessions">` to key the step-up gate rows on (the gate tables use
 * `v.id("authSessions")`, so a literal string id won't validate).
 */
export async function seedSession(
  t: TestConvex,
  userId: Id<"users">,
): Promise<Id<"authSessions">> {
  return await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 60 * 60 * 1000,
    }),
  );
}

/**
 * Attach a `password` auth account to a user so `hasPasswordAccount` (and thus
 * the always-on login-OTP gate) applies. Passwordless accounts skip the gate.
 */
export async function seedPasswordAccount(
  t: TestConvex,
  userId: Id<"users">,
): Promise<void> {
  await t.run((ctx) =>
    ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: `pwd-${userId}`,
    }),
  );
}

/**
 * Act as a user on a session that proved the account's number (a WhatsApp
 * code, session_proofs.ts): what a phone-otp sign-in opens.
 */
export async function asPhoneProvenUser(t: TestConvex, userId: Id<"users">) {
  const sessionId = await seedSession(t, userId);
  await t.run((ctx) =>
    ctx.db.insert("auth_session_proofs", {
      sessionId,
      userId,
      kind: "phone",
      verifiedAt: Date.now(),
    }),
  );
  return asUserSession(t, userId, sessionId);
}

/** Mark a session as having cleared the always-on login-OTP step. */
export async function clearLoginOtp(
  t: TestConvex,
  userId: Id<"users">,
  sessionId: Id<"authSessions">,
): Promise<void> {
  await t.run((ctx) =>
    ctx.db.insert("auth_session_login_otp", {
      sessionId,
      userId,
      verifiedAt: Date.now(),
    }),
  );
}

/** Enroll (verified) TOTP for a user so the TOTP gate applies. */
export async function seedVerifiedTotp(
  t: TestConvex,
  userId: Id<"users">,
): Promise<void> {
  const now = Date.now();
  await t.run((ctx) =>
    ctx.db.insert("totp_secrets", {
      userId,
      secret: "JBSWY3DPEHPK3PXP",
      verifiedAt: now,
      createdAt: now,
    }),
  );
}

/** Mark a session as having cleared the TOTP step. */
export async function clearTotp(
  t: TestConvex,
  userId: Id<"users">,
  sessionId: Id<"authSessions">,
): Promise<void> {
  await t.run((ctx) =>
    ctx.db.insert("auth_session_totp", {
      sessionId,
      userId,
      verifiedAt: Date.now(),
    }),
  );
}

/** Build a fresh, HMAC-signed audit envelope accepted by `verifyAuditContext`. */
export async function signedAudit(city?: string) {
  const ip = "127.0.0.1";
  const country = "FR";
  const ts = Date.now();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(process.env.KEEPLAS_CTX_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(
      city === undefined
        ? `${ip}|${country}|${ts}`
        : `${ip}|${country}|${ts}|${city}`,
    ),
  );
  const sig = Buffer.from(new Uint8Array(sigBuf)).toString("base64");
  return city === undefined
    ? { ip, country, ts, sig }
    : { ip, country, ts, sig, city };
}

/** Seed an accepted trust contact; `n` only keeps names / tokens unique. */
export async function seedTrustContact(
  t: TestConvex,
  ownerId: Id<"users">,
  opts: { n: number },
): Promise<Id<"trusted_contacts">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("trusted_contacts", {
      userId: ownerId,
      name: `Contact ${opts.n}`,
      email: `c${opts.n}@example.com`,
      role: "family",
      contactType: "trust",
      invitationStatus: "accepted",
      invitationToken: `tok-${opts.n}-${now}`,
      invitedAt: now,
      contactPublicKey: "pk",
      createdAt: now,
      updatedAt: now,
    }),
  );
}
