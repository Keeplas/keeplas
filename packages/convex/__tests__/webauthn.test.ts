import { afterEach, beforeEach, describe, it, expect } from "vitest";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
} from "@simplewebauthn/server";
import { api, internal } from "../_generated/api";
import { REQUIRED_USER_VERIFICATION } from "../webauthn";
import { makeT, signedAudit, type TestConvex } from "./test.helpers";

/**
 * Security regression guard (finding #6): the server passkey flow must demand
 * user verification (PIN / biometric / passcode), not possession alone. These
 * tests pin the shared option literal and prove the generated WebAuthn options
 * carry `userVerification: "required"` for BOTH registration and
 * authentication. They run the real @simplewebauthn/server option builders with
 * the exact value used in webauthn.ts, so a regression to "preferred" fails.
 */
describe("webauthn user verification hardening", () => {
  it("pins the shared user-verification policy to 'required'", () => {
    expect(REQUIRED_USER_VERIFICATION).toBe("required");
  });

  it("registration options require user verification", async () => {
    const options = await generateRegistrationOptions({
      rpName: "Keeplas Test",
      rpID: "localhost",
      userName: "curator@example.com",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: REQUIRED_USER_VERIFICATION,
      },
    });

    expect(options.authenticatorSelection?.userVerification).toBe("required");
  });

  it("authentication options require user verification", async () => {
    const options = await generateAuthenticationOptions({
      rpID: "localhost",
      userVerification: REQUIRED_USER_VERIFICATION,
    });

    expect(options.userVerification).toBe("required");
  });
});

// startAuthentication is public and signed out, and writes a challenge row
// on every call: it needs the sealed audit envelope, is throttled per IP,
// and abandoned challenges are swept once expired.
describe("passkey sign-in challenges", () => {
  beforeEach(() => {
    process.env.WEBAUTHN_RP_ID = "localhost";
  });
  afterEach(() => {
    delete process.env.WEBAUTHN_RP_ID;
  });

  const challenges = (t: TestConvex) =>
    t.run((ctx) => ctx.db.query("webauthn_challenges").collect());

  it("throttles challenge requests per IP", async () => {
    const t = makeT();
    const _audit = await signedAudit();
    for (let i = 0; i < 30; i++) {
      await t.mutation(api.webauthn.startAuthentication, { _audit });
    }

    await expect(
      t.mutation(api.webauthn.startAuthentication, { _audit }),
    ).rejects.toThrow("Too many requests");
    expect(await challenges(t)).toHaveLength(30);
  });

  it("stores no caller-supplied email", async () => {
    const t = makeT();
    await t.mutation(api.webauthn.startAuthentication, {
      _audit: await signedAudit(),
    });
    const [row] = await challenges(t);
    expect(row?.email).toBeUndefined();
  });

  it("sweeps expired challenges and keeps live ones", async () => {
    const t = makeT();
    const now = Date.now();
    await t.run(async (ctx) => {
      for (const expiresAt of [now - 1, now - 60_000, now + 60_000]) {
        await ctx.db.insert("webauthn_challenges", {
          challenge: `c${expiresAt}`,
          kind: "authentication",
          expiresAt,
        });
      }
    });

    await t.mutation(internal.webauthn.sweepExpiredChallenges, {});

    expect((await challenges(t)).map((c) => c.expiresAt)).toEqual([
      now + 60_000,
    ]);
  });
});
