"use node";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { wrapBytes } from "@keeplas/crypto/kem";
import { gateKeyAad } from "@keeplas/crypto/social";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auditContextValidator } from "./audit";
import { requireEnv } from "./lib/require_env";

/**
 * Gate-key custody. G is encrypted by a KMS bound to the owner's id, so the
 * database alone never yields it.
 *
 * GATE_KEY_KMS=infisical  Infisical KMS key INFISICAL_KMS_KEY_ID (production).
 * GATE_KEY_KMS=local      AES-256-GCM under GATE_KEY_LOCAL_KEK (dev and tests).
 */
type Kms = {
  encrypt(plaintext: Buffer, userId: string): Promise<string>;
  decrypt(ciphertext: string, userId: string): Promise<Buffer>;
};

async function infisicalRequest(
  path: string,
  body: Record<string, string>,
  token?: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${requireEnv("INFISICAL_KMS_SITE_URL")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Infisical ${path} failed: HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Machine-identity (Universal Auth) access token, scoped to the KMS key. */
async function infisicalToken(): Promise<string> {
  const out = await infisicalRequest("/api/v1/auth/universal-auth/login", {
    clientId: requireEnv("INFISICAL_KMS_CLIENT_ID"),
    clientSecret: requireEnv("INFISICAL_KMS_CLIENT_SECRET"),
  });
  return out.accessToken as string;
}

const infisicalKeyPath = (op: "encrypt" | "decrypt") =>
  `/api/v1/kms/keys/${requireEnv("INFISICAL_KMS_KEY_ID")}/${op}`;

// Infisical KMS has no encryption context: the owner id is sealed inside the
// plaintext and checked on decrypt, so a ciphertext can't move between users.
const ownerPrefix = (userId: string) => Buffer.from(`${userId}\n`);

export const infisicalKms: Kms = {
  async encrypt(plaintext, userId) {
    const bound = Buffer.concat([ownerPrefix(userId), plaintext]);
    const out = await infisicalRequest(
      infisicalKeyPath("encrypt"),
      { plaintext: bound.toString("base64") },
      await infisicalToken(),
    );
    bound.fill(0);
    return `infisical:v1:${out.ciphertext as string}`;
  },
  async decrypt(ciphertext, userId) {
    const out = await infisicalRequest(
      infisicalKeyPath("decrypt"),
      { ciphertext: ciphertext.slice("infisical:v1:".length) },
      await infisicalToken(),
    );
    const bound = Buffer.from(out.plaintext as string, "base64");
    const prefix = ownerPrefix(userId);
    try {
      if (!bound.subarray(0, prefix.length).equals(prefix)) {
        throw new Error("Gate key is bound to another user");
      }
      return Buffer.from(bound.subarray(prefix.length));
    } finally {
      bound.fill(0);
    }
  },
};

const localKms: Kms = {
  async encrypt(plaintext, userId) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", localKek(), iv);
    cipher.setAAD(Buffer.from(userId));
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `local:v1:${Buffer.concat([iv, tag, ct]).toString("base64")}`;
  },
  async decrypt(ciphertext, userId) {
    const raw = Buffer.from(ciphertext.slice("local:v1:".length), "base64");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      localKek(),
      raw.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
  },
};

function localKek(): Buffer {
  const kek = Buffer.from(requireEnv("GATE_KEY_LOCAL_KEK"), "base64");
  if (kek.length !== 32) throw new Error("GATE_KEY_LOCAL_KEK must be 32 bytes");
  return kek;
}

function kms(): Kms {
  const provider = requireEnv("GATE_KEY_KMS");
  if (provider === "infisical") return infisicalKms;
  if (provider === "local") return localKms;
  throw new Error(`Unknown GATE_KEY_KMS "${provider}"`);
}

const kmsFor = (ciphertext: string): Kms =>
  ciphertext.startsWith("infisical:") ? infisicalKms : localKms;

/**
 * Owner device: store a new recovery generation. G goes under KMS here and
 * is never written in clear.
 */
export const setup = action({
  args: {
    generation: v.number(),
    socialEnvelope: v.string(),
    shares: v.array(
      v.object({
        contactId: v.id("trusted_contacts"),
        wrappedShare: v.string(),
      }),
    ),
    gateKey: v.string(),
    completesRequestId: v.optional(v.id("recovery_requests")),
    _audit: auditContextValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");
    const gateKey = Buffer.from(args.gateKey, "base64");
    if (gateKey.length !== 32) throw new ConvexError("Invalid gate key");
    const gateKeyCiphertext = await kms().encrypt(gateKey, userId);
    gateKey.fill(0);
    const { gateKey: _clear, ...rest } = args;
    await ctx.runMutation(internal.recovery.storeSetup, {
      ...rest,
      gateKeyCiphertext,
    });
  },
});

/**
 * Scheduled at windowEndsAt, and right after the 2nd approval if the window
 * is already over. Releases G sealed to the new device key, only when 2
 * approvals exist, the window elapsed and nothing was cancelled.
 */
export const release = internalAction({
  args: { requestId: v.id("recovery_requests") },
  handler: async (ctx, args): Promise<boolean> => {
    const releasable = await ctx.runQuery(internal.recovery.getReleasable, {
      requestId: args.requestId,
    });
    if (!releasable) return false;
    const g = await kmsFor(releasable.kmsCiphertext).decrypt(
      releasable.kmsCiphertext,
      releasable.userId,
    );
    try {
      const wrappedGateKey = await wrapBytes(
        new Uint8Array(g),
        releasable.newDevicePublicKey,
        gateKeyAad(args.requestId),
      );
      return await ctx.runMutation(internal.recovery.markReleased, {
        requestId: args.requestId,
        wrappedGateKey,
      });
    } finally {
      g.fill(0);
    }
  },
});
