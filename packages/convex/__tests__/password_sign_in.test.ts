import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { makeT, signedAudit, type TestConvex } from "./test.helpers";

const EMAIL = "ada@example.com";

async function seedPasswordUser(t: TestConvex) {
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: EMAIL });
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: EMAIL,
      secret: "not-a-real-scrypt-hash",
    });
  });
}

describe("password provider", () => {
  // The library's "email-verification" flow signs in with an emailed 6-digit
  // code alone, never checking the password.
  it("refuses the emailed-code (email-verification) flow", async () => {
    const t = makeT();
    await seedPasswordUser(t);

    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: {
          flow: "email-verification",
          email: EMAIL,
          _audit: await signedAudit(),
        },
      }),
    ).rejects.toThrow("Email verification is not enabled");
  });

  it("needs the sealed audit envelope", async () => {
    const t = makeT();
    await seedPasswordUser(t);

    await expect(
      t.action(api.auth.signIn, {
        provider: "password",
        params: { flow: "signIn", email: EMAIL, password: "guess" },
      }),
    ).rejects.toThrow(/_audit/);
  });

  // The library only limits failures per account: one client must not be
  // able to try passwords across every account.
  it("throttles sign-in attempts per IP across accounts", async () => {
    const t = makeT();
    const _audit = await signedAudit();
    const attempt = (n: number) =>
      t.action(api.auth.signIn, {
        provider: "password",
        params: {
          flow: "signIn",
          email: `probe${n}@example.com`,
          password: "guess",
          _audit,
        },
      });
    for (let n = 0; n < 20; n++) {
      await expect(attempt(n)).rejects.toThrow("InvalidAccountId");
    }

    await expect(attempt(20)).rejects.toThrow("Too many requests");
  });
});
