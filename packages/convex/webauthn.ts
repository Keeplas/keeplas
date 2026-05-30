import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { optionalAuth, requireAuth } from "./helpers";
import { requireEnv } from "./lib/require_env";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Require user verification (PIN / biometric / device passcode) on every
 * passkey ceremony — registration and authentication alike. Without this an
 * attacker with mere possession of an unlocked authenticator could register or
 * sign in, defeating the second factor. Exported so tests can assert the value
 * stays "required" and never silently regresses to "preferred".
 */
export const REQUIRED_USER_VERIFICATION = "required" as const;

function getRpId(): string {
  return requireEnv("WEBAUTHN_RP_ID");
}

function getRpName(): string {
  return requireEnv("WEBAUTHN_RP_NAME");
}

function getExpectedOrigin(): string | string[] {
  const raw = requireEnv("WEBAUTHN_ORIGIN");
  return raw.includes(",") ? raw.split(",").map((s) => s.trim()) : raw;
}

async function persistChallenge(
  ctx: MutationCtx,
  challenge: string,
  kind: "registration" | "authentication",
  userId: Id<"users"> | undefined,
  email: string | undefined,
) {
  await ctx.db.insert("webauthn_challenges", {
    challenge,
    kind,
    userId,
    email,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
}

async function consumeChallenge(
  ctx: MutationCtx,
  challenge: string,
  kind: "registration" | "authentication",
): Promise<Doc<"webauthn_challenges">> {
  const row = await ctx.db
    .query("webauthn_challenges")
    .withIndex("by_challenge", (q) => q.eq("challenge", challenge))
    .first();
  if (!row || row.kind !== kind) {
    throw new Error("Challenge not found or invalid");
  }
  if (row.expiresAt < Date.now()) {
    await ctx.db.delete(row._id);
    throw new Error("Challenge expired");
  }
  await ctx.db.delete(row._id);
  return row;
}

export const startRegistration = mutation({
  args: { deviceName: v.optional(v.string()) },
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("passkey_credentials")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const options = await generateRegistrationOptions({
      rpName: getRpName(),
      rpID: getRpId(),
      userName: user.email ?? userId,
      userDisplayName: user.name ?? user.email ?? "Curator",
      userID: new TextEncoder().encode(userId),
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[] | undefined,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        // Require user verification (PIN/biometric), not just possession.
        userVerification: REQUIRED_USER_VERIFICATION,
      },
    });

    await persistChallenge(
      ctx,
      options.challenge,
      "registration",
      userId,
      user.email,
    );
    return options;
  },
});

export const finishRegistration = mutation({
  args: {
    response: v.any(),
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, { response, deviceName }) => {
    const userId = await requireAuth(ctx);
    const challenge = response?.response?.clientDataJSON
      ? extractChallenge(response.response.clientDataJSON)
      : undefined;
    if (!challenge) throw new Error("Missing challenge in response");

    const stored = await consumeChallenge(ctx, challenge, "registration");
    if (stored.userId !== userId) {
      throw new Error("Challenge does not belong to this user");
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: getExpectedOrigin(),
      expectedRPID: getRpId(),
      // Reject possession-only registrations missing user verification.
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Passkey registration failed verification");
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const now = Date.now();
    await ctx.db.insert("passkey_credentials", {
      userId,
      credentialId: credential.id,
      publicKey: bufToBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports,
      deviceName: deviceName?.trim() || guessDeviceName(),
      backedUp: credentialBackedUp,
      deviceType: credentialDeviceType,
      createdAt: now,
      lastUsedAt: now,
    });

    const user = await ctx.db.get(userId);
    if (user) {
      const providers = new Set(user.authProviders ?? []);
      providers.add("passkey");
      await ctx.db.patch(userId, {
        authProviders: Array.from(providers) as Doc<"users">["authProviders"],
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

export const startAuthentication = mutation({
  args: { email: v.optional(v.string()) },
  handler: async (ctx, { email }) => {
    let allowCredentials: {
      id: string;
      transports?: AuthenticatorTransportFuture[];
    }[] = [];
    let resolvedUserId: Id<"users"> | undefined;
    const trimmed = email?.trim().toLowerCase();

    if (trimmed) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", trimmed))
        .first();
      if (user) {
        resolvedUserId = user._id;
        const credentials = await ctx.db
          .query("passkey_credentials")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
        allowCredentials = credentials.map((c) => ({
          id: c.credentialId,
          transports: c.transports as
            | AuthenticatorTransportFuture[]
            | undefined,
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: getRpId(),
      // Require user verification (PIN/biometric), not just possession.
      userVerification: REQUIRED_USER_VERIFICATION,
      allowCredentials:
        allowCredentials.length > 0 ? allowCredentials : undefined,
    });

    await persistChallenge(
      ctx,
      options.challenge,
      "authentication",
      resolvedUserId,
      trimmed,
    );
    return options;
  },
});

export const consumeAuthenticationChallenge = internalMutation({
  args: { challenge: v.string() },
  handler: async (ctx, { challenge }) => {
    return await consumeChallenge(ctx, challenge, "authentication");
  },
});

export const findCredentialById = internalQuery({
  args: { credentialId: v.string() },
  handler: async (ctx, { credentialId }) => {
    return await ctx.db
      .query("passkey_credentials")
      .withIndex("by_credential_id", (q) => q.eq("credentialId", credentialId))
      .first();
  },
});

export const recordSuccessfulAuthentication = internalMutation({
  args: { credentialId: v.id("passkey_credentials"), counter: v.number() },
  handler: async (ctx, { credentialId, counter }) => {
    await ctx.db.patch(credentialId, {
      counter,
      lastUsedAt: Date.now(),
    });
  },
});

/**
 * Verify a WebAuthn assertion and return the userId that owns the credential.
 * Called from the passkey ConvexCredentials provider in `auth.ts`.
 */
export async function verifyAssertionAndGetUserId(
  ctx: {
    runMutation: <T>(name: any, args: any) => Promise<T>;
    runQuery: <T>(name: any, args: any) => Promise<T>;
  },
  response: any,
): Promise<Id<"users">> {
  const challenge = extractChallenge(response?.response?.clientDataJSON);
  if (!challenge) throw new Error("Missing challenge in response");

  const stored = await ctx.runMutation<Doc<"webauthn_challenges">>(
    internal.webauthn.consumeAuthenticationChallenge,
    { challenge },
  );

  const credential = await ctx.runQuery<Doc<"passkey_credentials"> | null>(
    internal.webauthn.findCredentialById,
    { credentialId: response.id },
  );
  if (!credential) throw new Error("Unknown passkey");

  if (stored.userId && stored.userId !== credential.userId) {
    throw new Error("Credential does not match challenge");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: getExpectedOrigin(),
    expectedRPID: getRpId(),
    credential: {
      id: credential.credentialId,
      publicKey: base64UrlToBuf(
        credential.publicKey,
      ) as Uint8Array<ArrayBuffer>,
      counter: credential.counter,
      transports: credential.transports as
        | AuthenticatorTransportFuture[]
        | undefined,
    },
    // Reject possession-only assertions missing user verification.
    requireUserVerification: true,
  });

  if (!verification.verified) {
    throw new Error("Passkey verification failed");
  }

  await ctx.runMutation(internal.webauthn.recordSuccessfulAuthentication, {
    credentialId: credential._id,
    counter: verification.authenticationInfo.newCounter,
  });

  return credential.userId;
}

export const listMyCredentials = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("passkey_credentials")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .map((c) => ({
        _id: c._id,
        deviceName: c.deviceName,
        createdAt: c.createdAt,
        lastUsedAt: c.lastUsedAt,
        backedUp: c.backedUp ?? false,
        deviceType: c.deviceType ?? null,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const removeCredential = mutation({
  args: { credentialId: v.id("passkey_credentials") },
  handler: async (ctx, { credentialId }) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db.get(credentialId);
    if (!row || row.userId !== userId) {
      throw new Error("Passkey not found");
    }
    await ctx.db.delete(credentialId);

    const remaining = await ctx.db
      .query("passkey_credentials")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (remaining.length === 0) {
      const user = await ctx.db.get(userId);
      if (user?.authProviders) {
        const next = user.authProviders.filter((p) => p !== "passkey");
        await ctx.db.patch(userId, {
          authProviders: next.length > 0 ? next : undefined,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

function extractChallenge(
  clientDataJSON: string | undefined,
): string | undefined {
  if (!clientDataJSON) return undefined;
  try {
    const json = JSON.parse(
      new TextDecoder().decode(base64UrlToBuf(clientDataJSON)),
    ) as { challenge?: string };
    return json.challenge;
  } catch {
    return undefined;
  }
}

function bufToBase64Url(buf: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuf(s: string): Uint8Array {
  const padded =
    s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function guessDeviceName(): string {
  return "New device";
}
