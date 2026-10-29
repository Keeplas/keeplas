import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { sha256Hex } from "../lib/crypto";
import {
  asUser,
  makeT,
  seedStorageRef,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// Convex prod replaces the message of a plain `Error` with "Server Error";
// only a ConvexError's data reaches the client. The app picks its copy by
// matching these messages (apps/mobile/src/lib/errors.ts and the screens
// that call errorText), so each one must be a ConvexError with string data.

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const PHONE = "+33612345678";
const OTHER_PHONE = "+33698765432";
const EMAIL = "owner@example.com";
const CODE = "123456";

async function expectConvexError(call: Promise<unknown>, text: string) {
  const error = await call.then(
    () => null,
    (failure: unknown) => failure,
  );
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<string>).data).toContain(text);
}

function seedUserWith(
  t: TestConvex,
  fields: { phoneNumber?: string; email?: string; verified?: boolean } = {},
): Promise<Id<"users">> {
  const now = Date.now();
  return t.run((ctx) =>
    ctx.db.insert("users", {
      phoneNumber: fields.phoneNumber,
      email: fields.email,
      ...(fields.verified && fields.phoneNumber
        ? { phoneNumberVerifiedAt: now }
        : {}),
      ...(fields.verified && fields.email
        ? { emailVerificationTime: now }
        : {}),
    }),
  );
}

describe("support form errors", () => {
  const ticket = {
    name: "Ada",
    contact: "ada@example.com",
    topic: "general" as const,
    subject: "General question",
    message: "Hello, I need some help.",
  };

  it.each([
    [{ name: " " }, "All fields are required"],
    [{ contact: "test" }, "valid email address or WhatsApp number"],
    [{ contact: "0612345678" }, "valid email address or WhatsApp number"],
    [{ message: "test" }, "at least 10 characters"],
  ])("%o → %s", async (change, text) => {
    const t = makeT();
    await expectConvexError(
      t.mutation(api.support.submitTicket, { ...ticket, ...change }),
      text,
    );
  });
});

describe("phone sign-in code errors", () => {
  it("rejects a malformed number", async () => {
    const t = makeT();
    await expectConvexError(
      t.mutation(api.phone_auth.requestPhoneAuthOtp, {
        phoneNumber: "0612345678",
        intent: "signin",
      }),
      "Invalid phone number",
    );
  });

  it("caps the salt lookup per IP", async () => {
    const t = makeT();
    const _audit = await signedAudit();
    for (let i = 0; i < 20; i++) {
      await t.mutation(api.phone_auth.getPhraseSaltByPhone, {
        phoneNumber: PHONE,
        _audit,
      });
    }
    await expectConvexError(
      t.mutation(api.phone_auth.getPhraseSaltByPhone, {
        phoneNumber: PHONE,
        _audit,
      }),
      "Too many requests",
    );
  });
});

describe("phone verification errors", () => {
  it("rejects an empty number", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await expectConvexError(
      asUser(t, userId).mutation(api.phone_verification.requestVerification, {
        phoneNumber: " ",
      }),
      "A valid phone number is required",
    );
  });

  it("rejects the current number", async () => {
    const t = makeT();
    const userId = await seedUserWith(t, {
      phoneNumber: PHONE,
      verified: true,
    });
    await expectConvexError(
      asUser(t, userId).mutation(api.phone_verification.requestVerification, {
        phoneNumber: PHONE,
      }),
      "New phone number is the same",
    );
  });

  it("rejects a number linked to another account", async () => {
    const t = makeT();
    await seedUserWith(t, { phoneNumber: OTHER_PHONE });
    const userId = await seedUser(t);
    await expectConvexError(
      asUser(t, userId).mutation(api.phone_verification.requestVerification, {
        phoneNumber: OTHER_PHONE,
      }),
      "already linked to another account",
    );
  });

  it("rejects a number another account signs in with, at verify time", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const otherId = await seedUser(t);
    const codeHash = await sha256Hex(CODE);
    await t.run(async (ctx) => {
      await ctx.db.insert("authAccounts", {
        userId: otherId,
        provider: "phone-otp",
        providerAccountId: OTHER_PHONE,
      });
      await ctx.db.insert("phone_verification_codes", {
        userId,
        phoneNumber: OTHER_PHONE,
        codeHash,
        expiresAt: Date.now() + 60_000,
        attempts: 0,
      });
    });
    await expectConvexError(
      asUser(t, userId).mutation(api.phone_verification.verifyCode, {
        code: CODE,
        _audit: await signedAudit(),
      }),
      "already linked to another account",
    );
  });
});

describe("email verification errors", () => {
  it("rejects an invalid address", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await expectConvexError(
      asUser(t, userId).mutation(api.email_verification.requestVerification, {
        email: "ada@",
      }),
      "Invalid email address",
    );
  });

  it("rejects the current address", async () => {
    const t = makeT();
    const userId = await seedUserWith(t, { email: EMAIL, verified: true });
    await expectConvexError(
      asUser(t, userId).mutation(api.email_verification.requestVerification, {
        email: EMAIL,
      }),
      "New email is the same",
    );
  });

  it("rejects an address linked to another account", async () => {
    const t = makeT();
    await seedUserWith(t, { email: EMAIL });
    const userId = await seedUser(t);
    await expectConvexError(
      asUser(t, userId).mutation(api.email_verification.requestVerification, {
        email: EMAIL,
      }),
      "already linked to another account",
    );
  });

  it("rejects the current address at verify time", async () => {
    const t = makeT();
    const userId = await seedUserWith(t, { email: EMAIL, verified: true });
    const codeHash = await sha256Hex(CODE);
    await t.run((ctx) =>
      ctx.db.insert("email_verification_codes", {
        userId,
        email: EMAIL,
        codeHash,
        expiresAt: Date.now() + 60_000,
        attempts: 0,
      }),
    );
    await expectConvexError(
      asUser(t, userId).mutation(api.email_verification.verifyCodeAndLink, {
        code: CODE,
        _audit: await signedAudit(),
      }),
      "New email is the same",
    );
  });

  it("rejects an address another account signs in with, at verify time", async () => {
    const t = makeT();
    const userId = await seedUserWith(t, {
      email: "old@example.com",
      verified: true,
    });
    const otherId = await seedUser(t);
    const codeHash = await sha256Hex(CODE);
    await t.run(async (ctx) => {
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "email-otp",
        providerAccountId: "old@example.com",
      });
      await ctx.db.insert("authAccounts", {
        userId: otherId,
        provider: "email-otp",
        providerAccountId: EMAIL,
      });
      await ctx.db.insert("email_verification_codes", {
        userId,
        email: EMAIL,
        codeHash,
        expiresAt: Date.now() + 60_000,
        attempts: 0,
      });
    });
    await expectConvexError(
      asUser(t, userId).mutation(api.email_verification.verifyCodeAndLink, {
        code: CODE,
        _audit: await signedAudit(),
      }),
      "already linked to another account",
    );
  });
});

describe("account errors", () => {
  it.each([
    [Number.POSITIVE_INFINITY, "Invalid birthday"],
    [Date.now() - 10 * YEAR_MS, "at least 18"],
    [Date.now() - 200 * YEAR_MS, "implausibly old"],
  ])("birthday %s → %s", async (birthday, text) => {
    const t = makeT();
    const userId = await seedUser(t);
    await expectConvexError(
      asUser(t, userId).mutation(api.users.updateBirthday, {
        birthday,
        _audit: await signedAudit(),
      }),
      text,
    );
  });

  it("rejects a country that isn't an ISO code", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await expectConvexError(
      asUser(t, userId).mutation(api.users.completeLegalInfo, {
        birthday: Date.now() - 30 * YEAR_MS,
        country: "France",
        _audit: await signedAudit(),
      }),
      "2-letter ISO-3166-1 code",
    );
    await expectConvexError(
      asUser(t, userId).mutation(api.users.updateLegalResidence, {
        country: "France",
        _audit: await signedAudit(),
      }),
      "2-letter ISO-3166-1 code",
    );
  });

  it("rejects the current country", async () => {
    const t = makeT();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { country: "FR" }),
    );
    await expectConvexError(
      asUser(t, userId).mutation(api.users.updateLegalResidence, {
        country: "fr",
        _audit: await signedAudit(),
      }),
      "New country is the same",
    );
  });

  it("rejects an avatar image another account holds", async () => {
    const t = makeT();
    const storageId = await seedStorageRef(t);
    const holder = await seedUser(t);
    await asUser(t, holder).mutation(api.users.setAvatarImage, {
      storageId,
      _audit: await signedAudit(),
    });
    const userId = await seedUser(t);
    await expectConvexError(
      asUser(t, userId).mutation(api.users.setAvatarImage, {
        storageId,
        _audit: await signedAudit(),
      }),
      "could not be resolved",
    );
  });
});
