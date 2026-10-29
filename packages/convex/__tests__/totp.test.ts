import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import {
  asUserSession,
  clearTotp,
  makeT,
  seedPasswordAccount,
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

describe("totp codes are single-use (RFC 6238 §5.2)", () => {
  it("a second session cannot replay a code the first one used", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await seedVerifiedTotp(t, userId);
    const first = asUserSession(t, userId, await seedSession(t, userId));
    const second = asUserSession(t, userId, await seedSession(t, userId));
    const code = totpCode();

    await expect(
      first.mutation(api.totp.submitTotpForSession, { code }),
    ).resolves.toMatchObject({ success: true });
    await expect(
      second.mutation(api.totp.submitTotpForSession, { code }),
    ).resolves.toMatchObject({ success: false });
    expect(await second.query(api.totp.getMyTotpGate, {})).toMatchObject({
      required: true,
    });

    // The next 30 s step still works.
    await expect(
      second.mutation(api.totp.submitTotpForSession, {
        code: totpCode(Date.now() + 30_000),
      }),
    ).resolves.toMatchObject({ success: true });
  });
});

describe("totp.verifyAndEnable", () => {
  /** A pending (unverified) enrollment of the seeded secret. */
  async function pendingEnrollment() {
    const t = makeT();
    const userId = await seedUser(t);
    await t.run((ctx) =>
      ctx.db.insert("totp_secrets", {
        userId,
        secret: "JBSWY3DPEHPK3PXP",
        createdAt: Date.now(),
      }),
    );
    return {
      t,
      userId,
      as: asUserSession(t, userId, await seedSession(t, userId)),
    };
  }

  it("needs every step-up gate: a password alone cannot enroll", async () => {
    const { t, userId, as } = await pendingEnrollment();
    await seedPasswordAccount(t, userId);
    await expect(
      as.mutation(api.totp.startEnrollment, { label: "attacker" }),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
    await expect(
      as.mutation(api.totp.verifyAndEnable, {
        code: totpCode(),
        recoveryVerifierHash: "attacker-verifier",
      }),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
    expect((await totpRow(t))?.verifiedAt).toBeUndefined();
  });

  it("counts wrong codes and locks after 10, like every code check", async () => {
    const { t, as } = await pendingEnrollment();
    for (let i = 0; i < 10; i++) {
      await expect(
        as.mutation(api.totp.verifyAndEnable, { code: "000000" }),
      ).resolves.toMatchObject({ success: false });
    }
    expect((await totpRow(t))?.failedAttempts).toBe(10);
    await expect(
      as.mutation(api.totp.verifyAndEnable, { code: totpCode() }),
    ).rejects.toThrow("Too many attempts");
    expect((await totpRow(t))?.verifiedAt).toBeUndefined();
  });

  it("spends the code it enrolls with", async () => {
    const { t, userId, as } = await pendingEnrollment();
    const code = totpCode();
    await expect(
      as.mutation(api.totp.verifyAndEnable, { code }),
    ).resolves.toMatchObject({ success: true });
    expect((await totpRow(t))?.verifiedAt).toBeDefined();
    const other = asUserSession(t, userId, await seedSession(t, userId));
    await expect(
      other.mutation(api.totp.submitTotpForSession, { code }),
    ).resolves.toMatchObject({ success: false });
  });
});
