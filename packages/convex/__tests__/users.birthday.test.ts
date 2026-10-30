import { describe, it, expect } from "vitest";
import { makeFunctionReference } from "convex/server";
import { api } from "../_generated/api";
import {
  makeT,
  seedUser,
  asUser,
  asUserSession,
  seedPasswordAccount,
  seedSession,
  signedAudit,
} from "./test.helpers";

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

describe("updateBirthday", () => {
  it("sets and then changes the birthday", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const first = Date.now() - 30 * YEAR_MS;
    const second = first - YEAR_MS;

    for (const birthday of [first, second]) {
      await asUser(t, owner).mutation(api.users.updateBirthday, {
        birthday,
        _audit: await signedAudit(),
      });
    }

    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.birthday).toBe(second);
  });

  it("refuses someone under 18", async () => {
    const t = makeT();
    const owner = await seedUser(t);

    await expect(
      asUser(t, owner).mutation(api.users.updateBirthday, {
        birthday: Date.now() - 10 * YEAR_MS,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("at least 18");
  });

  it("refuses an implausible date", async () => {
    const t = makeT();
    const owner = await seedUser(t);

    await expect(
      asUser(t, owner).mutation(api.users.updateBirthday, {
        birthday: Date.now() - 200 * YEAR_MS,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("implausibly old");
  });
});

describe("legal identity", () => {
  it("needs a stepped-up session to change the birthday or the country", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await seedPasswordAccount(t, owner);
    // Password only: login-OTP not cleared.
    const as = asUserSession(t, owner, await seedSession(t, owner));

    await expect(
      as.mutation(api.users.updateBirthday, {
        birthday: Date.now() - 30 * YEAR_MS,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
    await expect(
      as.mutation(api.users.updateLegalResidence, {
        country: "BE",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
  });

  // The onboarding declaration is the anchor of the audit chain: nothing may
  // re-declare it (completeLegalInfo had no caller left).
  it("has no endpoint that rewrites the onboarding declaration", async () => {
    const t = makeT();
    const owner = await seedUser(t);

    await expect(
      asUser(t, owner).mutation(
        makeFunctionReference<"mutation">("users:completeLegalInfo"),
        {
          birthday: Date.now() - 30 * YEAR_MS,
          country: "FR",
          _audit: await signedAudit(),
        },
      ),
    ).rejects.toThrow();
  });
});
