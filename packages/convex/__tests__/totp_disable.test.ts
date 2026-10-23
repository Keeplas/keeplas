import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import {
  asUserSession,
  clearTotp,
  makeT,
  seedSession,
  seedUser,
  seedVerifiedTotp,
  signedAudit,
} from "./test.helpers";

// Base32 "JBSWY3DPEHPK3PXP", the secret seedVerifiedTotp enrolls.
const SECRET = Buffer.from("Hello!\xDE\xAD\xBE\xEF", "latin1");

/** RFC 6238 code for the seeded secret at `now` (30 s step, 6 digits). */
function totpCode(now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const sig = createHmac("sha1", SECRET).update(counter).digest();
  const offset = sig[sig.length - 1] & 0x0f;
  const code = (sig.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

/** A user with verified TOTP, on a session that already cleared it. */
async function enrolledSession() {
  const t = makeT();
  const userId = await seedUser(t);
  await seedVerifiedTotp(t, userId);
  const sessionId = await seedSession(t, userId);
  await clearTotp(t, userId, sessionId);
  return { t, userId, as: asUserSession(t, userId, sessionId) };
}

const totpRow = (t: ReturnType<typeof makeT>) =>
  t.run((ctx) => ctx.db.query("totp_secrets").first());

describe("totp.disable", () => {
  it("turns TOTP off with a current code and records it", async () => {
    const { t, as } = await enrolledSession();
    await expect(
      as.mutation(api.totp.disable, {
        code: totpCode(),
        _audit: await signedAudit(),
      }),
    ).resolves.toMatchObject({ success: true });
    expect(await totpRow(t)).toBeNull();
    const logs = await t.run((ctx) => ctx.db.query("audit_logs").collect());
    expect(logs.map((l) => l.action)).toEqual(["totp_disabled"]);
  });

  it("keeps TOTP on a wrong code, counts it and logs nothing", async () => {
    const { t, as } = await enrolledSession();
    await expect(
      as.mutation(api.totp.disable, {
        code: "000000",
        _audit: await signedAudit(),
      }),
    ).resolves.toMatchObject({ success: false });
    const row = await totpRow(t);
    expect(row?.failedAttempts).toBe(1);
    expect(await t.run((ctx) => ctx.db.query("audit_logs").collect())).toEqual(
      [],
    );
  });

  it("locks after 10 wrong codes, even with the right one", async () => {
    const { t, as } = await enrolledSession();
    for (let i = 0; i < 10; i++) {
      await as.mutation(api.totp.disable, {
        code: "000000",
        _audit: await signedAudit(),
      });
    }
    await expect(
      as.mutation(api.totp.disable, {
        code: totpCode(),
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Too many attempts");
    expect(await totpRow(t)).not.toBeNull();
  });

  it("refuses a session that has not cleared TOTP", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await seedVerifiedTotp(t, userId);
    const sessionId = await seedSession(t, userId);
    await expect(
      asUserSession(t, userId, sessionId).mutation(api.totp.disable, {
        code: totpCode(),
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("TOTP_REQUIRED");
    expect(await totpRow(t)).not.toBeNull();
  });
});
