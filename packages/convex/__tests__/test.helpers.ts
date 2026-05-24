import { convexTest } from "convex-test";
import schema from "../schema";
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

/** Act as the given user — `getAuthUserId` reads `subject.split("|")[0]`. */
export function asUser(t: TestConvex, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|test-session` });
}

/** Build a fresh, HMAC-signed audit envelope accepted by `verifyAuditContext`. */
export async function signedAudit() {
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
    enc.encode(`${ip}|${country}|${ts}`),
  );
  const sig = Buffer.from(new Uint8Array(sigBuf)).toString("base64");
  return { ip, country, ts, sig };
}

/** Seed an accepted trust contact holding the given shard slot. */
export async function seedTrustContact(
  t: TestConvex,
  ownerId: Id<"users">,
  opts: { shardIndex: number; confirmed?: boolean },
): Promise<Id<"trusted_contacts">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("trusted_contacts", {
      userId: ownerId,
      name: `Contact ${opts.shardIndex}`,
      email: `c${opts.shardIndex}@example.com`,
      role: "family",
      contactType: "trust",
      invitationStatus: "accepted",
      invitationToken: `tok-${opts.shardIndex}-${now}`,
      invitedAt: now,
      shardIndex: opts.shardIndex,
      contactPublicKey: "pk",
      shardConfirmed: opts.confirmed ?? false,
      createdAt: now,
      updatedAt: now,
    }),
  );
}
