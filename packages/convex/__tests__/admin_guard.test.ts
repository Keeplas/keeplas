import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  makeT,
  asUserSession,
  clearLoginOtp,
  seedPasswordAccount,
  seedSession,
  seedVerifiedTotp,
  type TestConvex,
} from "./test.helpers";

// Admin functions (number-change approvals among them) need an admin session
// that cleared every step-up gate: an admin's password alone is not enough.

async function seedPasswordAdmin(t: TestConvex): Promise<Id<"users">> {
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "support@keeplas.com", role: "admin" }),
  );
  await seedPasswordAccount(t, adminId);
  return adminId;
}

describe("requireAdmin", () => {
  it("refuses an admin session that has not cleared the login OTP", async () => {
    const t = makeT();
    const adminId = await seedPasswordAdmin(t);
    const as = asUserSession(t, adminId, await seedSession(t, adminId));
    await expect(as.query(api.admin.access.whoami, {})).rejects.toThrow(
      "LOGIN_OTP_REQUIRED",
    );
    await expect(
      as.query(api.admin.recovery_requests.listOpen, {}),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
  });

  it("refuses an admin with TOTP enrolled until the session clears it", async () => {
    const t = makeT();
    const adminId = await seedPasswordAdmin(t);
    await seedVerifiedTotp(t, adminId);
    const sessionId = await seedSession(t, adminId);
    await clearLoginOtp(t, adminId, sessionId);
    await expect(
      asUserSession(t, adminId, sessionId).query(api.admin.access.whoami, {}),
    ).rejects.toThrow("TOTP_REQUIRED");
  });

  it("lets a stepped-up admin in", async () => {
    const t = makeT();
    const adminId = await seedPasswordAdmin(t);
    const sessionId = await seedSession(t, adminId);
    await clearLoginOtp(t, adminId, sessionId);
    await expect(
      asUserSession(t, adminId, sessionId).query(api.admin.access.whoami, {}),
    ).resolves.toMatchObject({ email: "support@keeplas.com" });
  });
});
