import { afterEach, describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import {
  MOBILE_ONLY_SIGNUP,
  SIGNUP_ATTESTATION_REQUIRED,
  refuseNonMobileSignUp,
} from "../attestation";
import { checkPlayIntegrityVerdict } from "../attestation_node";
import { sha256Hex } from "../lib/crypto";
import { makeT, signedAudit, type TestConvex } from "./test.helpers";

// Phase 4 (F8, M09-9): sign-up is mobile-only. A phone-otp sign-up code is
// only issued after App Attest / Play Integrity; email sign-up is closed.

const PHONE = "+33612345678";

async function attestAsSimulator(t: TestConvex, phoneNumber = PHONE) {
  const { challengeId } = await t.mutation(api.attestation.createChallenge, {
    _audit: await signedAudit(),
  });
  return t.action(api.attestation_node.verify, {
    challengeId,
    phoneNumber,
    platform: "simulator",
    token: "none",
  });
}

async function requestSignupOtp(t: TestConvex, phoneNumber = PHONE) {
  return t.mutation(api.phone_auth.requestPhoneAuthOtp, {
    _audit: await signedAudit(),
    phoneNumber,
    intent: "signup",
  });
}

describe("mobile-only sign-up", () => {
  afterEach(() => {
    delete process.env.ATTESTATION_SIMULATOR_BYPASS;
  });

  it("refuses a sign-up code without attestation (M09-9)", async () => {
    const t = makeT();
    await expect(requestSignupOtp(t)).rejects.toThrow(
      SIGNUP_ATTESTATION_REQUIRED,
    );
  });

  it("issues one sign-up code per attestation", async () => {
    process.env.ATTESTATION_SIMULATOR_BYPASS = "true";
    const t = makeT();
    await attestAsSimulator(t);
    await expect(requestSignupOtp(t)).resolves.toEqual({ sent: true });
    await expect(requestSignupOtp(t)).rejects.toThrow(
      SIGNUP_ATTESTATION_REQUIRED,
    );
  });

  it("binds the grant to the attested phone number", async () => {
    process.env.ATTESTATION_SIMULATOR_BYPASS = "true";
    const t = makeT();
    await attestAsSimulator(t, "+33600000000");
    await expect(requestSignupOtp(t)).rejects.toThrow(
      SIGNUP_ATTESTATION_REQUIRED,
    );
  });

  it("rejects the simulator platform unless the bypass is on", async () => {
    const t = makeT();
    await expect(attestAsSimulator(t)).rejects.toThrow("simulator");
  });

  it("rejects a forged App Attest object", async () => {
    const t = makeT();
    process.env.APPLE_TEAM_ID = "TEAMID1234";
    process.env.IOS_BUNDLE_ID = "com.keeplas.app";
    const { challengeId } = await t.mutation(api.attestation.createChallenge, {
      _audit: await signedAudit(),
    });
    await expect(
      t.action(api.attestation_node.verify, {
        challengeId,
        phoneNumber: PHONE,
        platform: "ios",
        token: Buffer.from("not cbor").toString("base64"),
        keyId: Buffer.alloc(32).toString("base64"),
      }),
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query("signup_attestations").collect()),
    ).toEqual([]);
  });

  it("uses each challenge once", async () => {
    const t = makeT();
    const { challengeId } = await t.mutation(api.attestation.createChallenge, {
      _audit: await signedAudit(),
    });
    await t.mutation(internal.attestation.consumeChallenge, { challengeId });
    await expect(
      t.mutation(internal.attestation.consumeChallenge, { challengeId }),
    ).rejects.toThrow("Invalid or expired challenge");
  });

  it("never lets a sign-in code create an account", async () => {
    const t = makeT();
    await t.run(async (ctx) => {
      await ctx.db.insert("phone_auth_codes", {
        phoneNumber: PHONE,
        codeHash: await sha256Hex("123456"),
        expiresAt: Date.now() + 60_000,
        attempts: 0,
        intent: "signin",
      });
    });
    await expect(
      t.mutation(internal.phone_auth.consumePhoneAuthCode, {
        phoneNumber: PHONE,
        code: "123456",
        intent: "signup",
      }),
    ).rejects.toThrow("Code expired or not requested");
  });

  it("closes email and password sign-up", async () => {
    const t = makeT();
    await expect(
      t.mutation(api.email_auth.requestEmailAuthOtp, {
        email: "new@example.com",
        intent: "signup",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow(MOBILE_ONLY_SIGNUP);
    expect(() => refuseNonMobileSignUp("signUp")).toThrow(MOBILE_ONLY_SIGNUP);
    expect(() => refuseNonMobileSignUp("signIn")).not.toThrow();
  });
});

describe("Play Integrity verdict", () => {
  const now = 1_700_000_000_000;
  const expected = { packageName: "com.keeplas.app", requestHash: "abc", now };
  const good = {
    requestDetails: {
      requestPackageName: "com.keeplas.app",
      requestHash: "abc",
      timestampMillis: String(now - 1000),
    },
    appIntegrity: { appRecognitionVerdict: "PLAY_RECOGNIZED" },
    deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"] },
  };

  it("accepts a genuine app on a genuine device", () => {
    expect(() => checkPlayIntegrityVerdict(good, expected)).not.toThrow();
  });

  it.each([
    [
      "package",
      {
        ...good,
        requestDetails: { ...good.requestDetails, requestPackageName: "evil" },
      },
    ],
    [
      "request hash",
      {
        ...good,
        requestDetails: { ...good.requestDetails, requestHash: "other" },
      },
    ],
    [
      "stale",
      {
        ...good,
        requestDetails: {
          ...good.requestDetails,
          timestampMillis: String(now - 10 * 60_000),
        },
      },
    ],
    [
      "app not recognized",
      {
        ...good,
        appIntegrity: { appRecognitionVerdict: "UNRECOGNIZED_VERSION" },
      },
    ],
    [
      "device integrity",
      { ...good, deviceIntegrity: { deviceRecognitionVerdict: [] } },
    ],
  ])("rejects a bad %s", (reason, payload) => {
    expect(() => checkPlayIntegrityVerdict(payload, expected)).toThrow(reason);
  });
});
