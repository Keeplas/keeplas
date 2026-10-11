"use node";

import { createHash, createSign, X509Certificate } from "node:crypto";
import { v, ConvexError } from "convex/values";
import { AsnParser } from "@peculiar/asn1-schema";
import { Certificate } from "@peculiar/asn1-x509";
import {
  convertCertBufferToPEM,
  decodeAttestationObject,
  parseAuthenticatorData,
  validateCertificatePath,
} from "@simplewebauthn/server/helpers";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { attestationPlatformValidator } from "./attestation";
import { requireEnv } from "./lib/require_env";

// https://www.apple.com/certificateauthority/Apple_App_Attestation_Root_CA.pem
// SHA-256 fingerprint 1C:B9:82:3B:A2:8B:A6:AD:2D:33:A0:06:94:1D:E2:AE:
// 4F:51:3E:F1:D4:E8:31:B9:F7:E0:FA:7B:62:42:C9:32, valid until 2045.
const APPLE_APP_ATTEST_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYw
JAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwK
QXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNa
Fw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlv
biBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9y
bmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdh
NbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9au
Yen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/
MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYw
CgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn
53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijV
oyFraWVIyd/dganmrduC1bmTBGwD
-----END CERTIFICATE-----`;

const APP_ATTEST_NONCE_OID = "1.2.840.113635.100.8.2";
const AAGUID_PRODUCTION = Buffer.concat([
  Buffer.from("appattest"),
  Buffer.alloc(7),
]);
const AAGUID_DEVELOPMENT = Buffer.from("appattestdevelop");
const PLAY_INTEGRITY_MAX_AGE_MS = 5 * 60 * 1000;

const sha256 = (data: Uint8Array | string) =>
  createHash("sha256").update(data).digest();

function fail(reason: string): never {
  throw new ConvexError(`Attestation rejected: ${reason}`);
}

/**
 * Verify an App Attest attestation object (Apple, "Validating apps that
 * connect to your server", steps 1–9). `challenge` is the string the app
 * passed to `attestKeyAsync`; the native module hashes it as UTF-8.
 */
export async function verifyAppAttestation(opts: {
  attestation: string; // base64
  keyId: string; // base64
  challenge: string;
  appId: string; // TEAMID.bundleId
  allowDevelopment: boolean;
}): Promise<void> {
  const decoded = decodeAttestationObject(
    new Uint8Array(Buffer.from(opts.attestation, "base64")),
  );
  if ((decoded.get("fmt") as string) !== "apple-appattest") fail("format");
  const attStmt = decoded.get("attStmt");
  const x5c = attStmt.get("x5c");
  const authData = decoded.get("authData");
  if (!x5c || x5c.length < 2 || !authData) fail("missing certificates");

  // 1. Certificate chain up to the Apple App Attestation root.
  try {
    await validateCertificatePath(
      x5c.map((cert) => convertCertBufferToPEM(cert)),
      [APPLE_APP_ATTEST_ROOT_CA],
    );
  } catch {
    fail("certificate chain");
  }

  // 2–4. nonce = SHA256(authData ‖ SHA256(challenge)) sits in the leaf.
  const clientDataHash = sha256(opts.challenge);
  const nonce = sha256(Buffer.concat([authData, clientDataHash]));
  const leaf = AsnParser.parse(x5c[0], Certificate);
  const ext = leaf.tbsCertificate.extensions?.find(
    (e) => e.extnID === APP_ATTEST_NONCE_OID,
  );
  if (!ext) fail("nonce extension");
  // DER: SEQUENCE { [1] { OCTET STRING (32) nonce } }; the nonce is the tail.
  const extValue = Buffer.from(ext.extnValue.buffer);
  if (!extValue.subarray(extValue.length - 32).equals(nonce)) fail("nonce");

  // 5. keyId = SHA256(uncompressed EC public key of the leaf).
  const jwk = new X509Certificate(Buffer.from(x5c[0])).publicKey.export({
    format: "jwk",
  });
  const point = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(jwk.x as string, "base64url"),
    Buffer.from(jwk.y as string, "base64url"),
  ]);
  const keyId = Buffer.from(opts.keyId, "base64");
  if (!sha256(point).equals(keyId)) fail("key id");

  // 6–9. App id, counter, environment and credential id.
  const parsed = parseAuthenticatorData(authData);
  if (!Buffer.from(parsed.rpIdHash).equals(sha256(opts.appId))) fail("app id");
  if (parsed.counter !== 0) fail("counter");
  const aaguid = Buffer.from(parsed.aaguid ?? []);
  const aaguidOk =
    aaguid.equals(AAGUID_PRODUCTION) ||
    (opts.allowDevelopment && aaguid.equals(AAGUID_DEVELOPMENT));
  if (!aaguidOk) fail("environment");
  if (!Buffer.from(parsed.credentialID ?? []).equals(keyId)) {
    fail("credential id");
  }
}

/** Decoded Play Integrity payload (`tokenPayloadExternal`), fields we read. */
export type PlayIntegrityPayload = {
  requestDetails?: {
    requestPackageName?: string;
    requestHash?: string;
    timestampMillis?: string;
  };
  appIntegrity?: { appRecognitionVerdict?: string };
  deviceIntegrity?: { deviceRecognitionVerdict?: string[] };
};

/** Check a decoded standard-request Play Integrity verdict. */
export function checkPlayIntegrityVerdict(
  payload: PlayIntegrityPayload,
  expected: { packageName: string; requestHash: string; now: number },
): void {
  const req = payload.requestDetails;
  if (req?.requestPackageName !== expected.packageName) fail("package");
  if (req?.requestHash !== expected.requestHash) fail("request hash");
  const age = expected.now - Number(req?.timestampMillis ?? 0);
  if (!(age >= -60_000 && age <= PLAY_INTEGRITY_MAX_AGE_MS)) fail("stale");
  if (payload.appIntegrity?.appRecognitionVerdict !== "PLAY_RECOGNIZED") {
    fail("app not recognized");
  }
  const device = payload.deviceIntegrity?.deviceRecognitionVerdict ?? [];
  if (!device.includes("MEETS_DEVICE_INTEGRITY")) fail("device integrity");
}

/** OAuth access token for a Google service account (JWT bearer grant). */
async function googleAccessToken(serviceAccountJson: string, scope: string) {
  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
  };
  const now = Math.floor(Date.now() / 1000);
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: sa.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 300,
  })}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function decodePlayIntegrityToken(
  token: string,
  packageName: string,
): Promise<PlayIntegrityPayload> {
  const accessToken = await googleAccessToken(
    requireEnv("GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT"),
    "https://www.googleapis.com/auth/playintegrity",
  );
  const res = await fetch(
    `https://playintegrity.googleapis.com/v1/${packageName}:decodeIntegrityToken`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ integrity_token: token }),
    },
  );
  if (!res.ok) fail("token not decodable");
  const body = (await res.json()) as {
    tokenPayloadExternal?: PlayIntegrityPayload;
  };
  return body.tokenPayloadExternal ?? {};
}

/**
 * App: prove the genuine Keeplas app runs on a real device, then receive a
 * one-time sign-up grant for `phoneNumber` (consumed by requestPhoneAuthOtp).
 *
 * - ios: `keyId` from `generateKeyAsync`, `token` from `attestKeyAsync`.
 * - android: `token` from `requestIntegrityCheckAsync(challenge)`.
 */
export const verify = action({
  args: {
    challengeId: v.string(),
    phoneNumber: v.string(),
    platform: attestationPlatformValidator,
    token: v.string(),
    keyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const challenge: string = await ctx.runMutation(
      internal.attestation.consumeChallenge,
      { challengeId: args.challengeId },
    );

    if (args.platform === "ios") {
      if (!args.keyId) fail("missing key id");
      await verifyAppAttestation({
        attestation: args.token,
        keyId: args.keyId,
        challenge,
        appId: `${requireEnv("APPLE_TEAM_ID")}.${requireEnv("IOS_BUNDLE_ID")}`,
        allowDevelopment: process.env.APP_ATTEST_ALLOW_DEVELOPMENT === "true",
      });
    } else if (args.platform === "android") {
      const packageName = requireEnv("ANDROID_PACKAGE_NAME");
      checkPlayIntegrityVerdict(
        await decodePlayIntegrityToken(args.token, packageName),
        { packageName, requestHash: challenge, now: Date.now() },
      );
    } else if (process.env.ATTESTATION_SIMULATOR_BYPASS !== "true") {
      fail("simulator");
    }

    await ctx.runMutation(internal.attestation.grantSignup, {
      phoneNumber: args.phoneNumber,
      platform: args.platform,
    });
    return { ok: true };
  },
});
