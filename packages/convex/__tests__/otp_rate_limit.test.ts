import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  asUser,
  asUserSession,
  makeT,
  seedSession,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

const PHONE = "+33612345678";
const EMAIL = "owner@example.com";

type Flow = {
  name: string;
  table:
    | "phone_auth_codes"
    | "email_auth_codes"
    | "phone_verification_codes"
    | "email_verification_codes"
    | "login_otp_codes";
  request: (t: TestConvex) => Promise<() => Promise<unknown>>;
};

const flows: Flow[] = [
  {
    name: "phone sign-in",
    table: "phone_auth_codes",
    request: async (t) => {
      await t.run((ctx) => ctx.db.insert("users", { phoneNumber: PHONE }));
      return () =>
        t.mutation(api.phone_auth.requestPhoneAuthOtp, {
          phoneNumber: PHONE,
          intent: "signin",
        });
    },
  },
  {
    name: "email sign-in",
    table: "email_auth_codes",
    request: async (t) => {
      await t.run((ctx) => ctx.db.insert("users", { email: EMAIL }));
      const _audit = await signedAudit();
      return () =>
        t.mutation(api.email_auth.requestEmailAuthOtp, {
          email: EMAIL,
          intent: "signin",
          _audit,
        });
    },
  },
  {
    name: "phone verification",
    table: "phone_verification_codes",
    request: async (t) => {
      const userId = await t.run((ctx) => ctx.db.insert("users", {}));
      return () =>
        asUser(t, userId).mutation(api.phone_verification.requestVerification, {
          phoneNumber: PHONE,
        });
    },
  },
  {
    name: "email verification",
    table: "email_verification_codes",
    request: async (t) => {
      const userId = await t.run((ctx) => ctx.db.insert("users", {}));
      return () =>
        asUser(t, userId).mutation(api.email_verification.requestVerification, {
          email: EMAIL,
        });
    },
  },
  {
    name: "login step-up",
    table: "login_otp_codes",
    request: async (t) => {
      const userId = await t.run((ctx) =>
        ctx.db.insert("users", { email: EMAIL }),
      );
      const sessionId = await seedSession(t, userId);
      return () =>
        asUserSession(t, userId, sessionId).mutation(
          api.login_otp.requestLoginOtp,
          {},
        );
    },
  },
];

describe.each(flows)("$name OTP rate limit", ({ table, request }) => {
  it("refuses the 4th code within an hour", async () => {
    const t = makeT();
    const send = await request(t);
    for (let i = 0; i < 3; i++) await send();
    await expect(send()).rejects.toThrow("Too many");
  });

  it("leaves only the newest code usable", async () => {
    const t = makeT();
    const send = await request(t);
    await send();
    await send();
    const now = Date.now();
    const codes = await t.run((ctx) => ctx.db.query(table).collect());
    expect(codes).toHaveLength(2);
    const newest = codes.reduce((a, b) =>
      a._creationTime > b._creationTime ? a : b,
    );
    for (const code of codes) {
      expect(code.expiresAt > now).toBe(code._id === newest._id);
    }
  });
});

// The per-account budget alone let many farmed accounts send codes to one
// victim's number or address: each destination has its own budget too.
describe("verification codes per destination", () => {
  const destinations = [
    {
      name: "phone",
      send: (t: TestConvex, userId: Id<"users">) =>
        asUser(t, userId).mutation(api.phone_verification.requestVerification, {
          phoneNumber: PHONE,
        }),
    },
    {
      name: "email",
      send: (t: TestConvex, userId: Id<"users">) =>
        asUser(t, userId).mutation(api.email_verification.requestVerification, {
          email: EMAIL,
        }),
    },
  ];

  it.each(destinations)(
    "refuses a 4th $name code within an hour across accounts",
    async ({ send }) => {
      const t = makeT();
      const account = () => t.run((ctx) => ctx.db.insert("users", {}));
      for (let i = 0; i < 3; i++) await send(t, await account());

      await expect(send(t, await account())).rejects.toThrow("Too many");
    },
  );
});
