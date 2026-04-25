import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { optionalAuth, requireAuth } from "./helpers";

const ISSUER = "Keeplas";
const STEP_SECONDS = 30;
const DIGITS = 6;
const VERIFICATION_WINDOW = 1; // accept ±1 step (30s drift)

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

function base32ToBytes(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function counterToBytes(counter: number): Uint8Array {
  const buf = new Uint8Array(8);
  let n = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = n & 0xff;
    n = Math.floor(n / 256);
  }
  return buf;
}

async function hotp(secretBytes: Uint8Array, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, counterToBytes(counter) as BufferSource)
  );
  const offset = sig[sig.length - 1] & 0x0f;
  const code =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

async function verifyTotp(
  secretBase32: string,
  code: string,
  now: number
): Promise<boolean> {
  const cleaned = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const secret = base32ToBytes(secretBase32);
  const counter = Math.floor(now / 1000 / STEP_SECONDS);
  for (let drift = -VERIFICATION_WINDOW; drift <= VERIFICATION_WINDOW; drift++) {
    const candidate = await hotp(secret, counter + drift);
    if (timingSafeEquals(candidate, cleaned)) return true;
  }
  return false;
}

function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function generateSecretBase32(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return bytesToBase32(bytes);
}

function buildOtpAuthUri(secret: string, account: string, label?: string): string {
  const issuer = encodeURIComponent(ISSUER);
  const account_ = encodeURIComponent(label ? `${account} (${label})` : account);
  const params = new URLSearchParams({
    secret,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${issuer}:${account_}?${params.toString()}`;
}

export const getMyTotpStatus = query({
  args: {},
  handler: async (ctx) => {
    const empty = {
      enrolled: false,
      pending: false,
      label: undefined as string | undefined,
      verifiedAt: null as number | null,
      lastUsedAt: null as number | null,
      createdAt: null as number | null,
    };
    const userId = await optionalAuth(ctx);
    if (userId === null) return empty;
    const row = await ctx.db
      .query("totp_secrets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!row) return empty;
    return {
      enrolled: !!row.verifiedAt,
      pending: !row.verifiedAt,
      label: row.label,
      verifiedAt: row.verifiedAt ?? null,
      lastUsedAt: row.lastUsedAt ?? null,
      createdAt: row.createdAt as number | null,
    };
  },
});

export const startEnrollment = mutation({
  args: { label: v.optional(v.string()) },
  handler: async (ctx, { label }) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("totp_secrets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing?.verifiedAt) {
      throw new Error(
        "An authenticator is already enrolled. Disable it before enrolling a new device."
      );
    }
    if (existing) {
      // Replace prior pending enrollment so the user can restart cleanly.
      await ctx.db.delete(existing._id);
    }

    const secret = generateSecretBase32();
    const accountName = user.email ?? "curator";
    await ctx.db.insert("totp_secrets", {
      userId,
      secret,
      label: label?.trim() || undefined,
      createdAt: Date.now(),
    });
    return {
      secret,
      uri: buildOtpAuthUri(secret, accountName, label?.trim() || undefined),
      issuer: ISSUER,
      account: accountName,
      digits: DIGITS,
      period: STEP_SECONDS,
    };
  },
});

export const verifyAndEnable = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db
      .query("totp_secrets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!row) throw new Error("Start enrollment first");
    if (row.verifiedAt) {
      throw new Error("Authenticator already verified");
    }
    const ok = await verifyTotp(row.secret, code, Date.now());
    if (!ok) throw new Error("Invalid or expired code. Try again.");

    const now = Date.now();
    await ctx.db.patch(row._id, { verifiedAt: now, lastUsedAt: now });

    const user = await ctx.db.get(userId);
    if (user) {
      const providers = new Set(user.authProviders ?? []);
      providers.add("totp");
      await ctx.db.patch(userId, {
        authProviders: Array.from(providers) as Doc<"users">["authProviders"],
        updatedAt: now,
      });
    }
    return { success: true };
  },
});

export const disable = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db
      .query("totp_secrets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!row) return { success: true };
    await ctx.db.delete(row._id);

    const user = await ctx.db.get(userId);
    if (user?.authProviders) {
      const next = user.authProviders.filter((p) => p !== "totp");
      await ctx.db.patch(userId, {
        authProviders: next.length > 0 ? next : undefined,
        updatedAt: Date.now(),
      });
    }
    return { success: true };
  },
});

export const cancelEnrollment = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db
      .query("totp_secrets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!row || row.verifiedAt) return { success: true };
    await ctx.db.delete(row._id);
    return { success: true };
  },
});
