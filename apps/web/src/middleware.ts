import { NextRequest, NextResponse } from "next/server";

/**
 * Cookie name carrying the sealed audit context. HttpOnly + SameSite=Strict
 * so it only travels server-to-server (read by `/api/context`) — the browser
 * never touches it directly.
 */
const COOKIE_NAME = "__keeplas_ctx";
const COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

const FALLBACK_IP = "0.0.0.0";
const FALLBACK_COUNTRY = "XX";

interface SealedContext {
  ip: string;
  country: string;
  ts: number;
  sig: string;
}

/**
 * Issues a sealed `{ip, country, ts, sig}` cookie on every request. The
 * signature is a Base64 HMAC-SHA256 over `${ip}|${country}|${ts}` using
 * `KEEPLAS_CTX_SECRET`. Convex mutations re-verify the seal before
 * persisting these values into the audit log — this is what prevents a
 * client from forging its own location.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next();

  const secret = process.env.KEEPLAS_CTX_SECRET;
  if (!secret) {
    // No secret configured — skip silently. Mutations will fail closed when
    // they try to verify a missing/invalid context, which is the correct
    // behavior in production. Local dev without the var degrades to "no
    // audited mutations succeed" until the operator sets it.
    return response;
  }

  const existing = request.cookies.get(COOKIE_NAME)?.value;
  if (existing && isFreshSealed(existing)) {
    return response;
  }

  const ip = extractIp(request);
  const country = extractCountry(request);
  const ts = Date.now();
  const sig = await sign(`${ip}|${country}|${ts}`, secret);

  const sealed: SealedContext = { ip, country, ts, sig };
  response.cookies.set(COOKIE_NAME, JSON.stringify(sealed), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  return response;
}

function extractIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? FALLBACK_IP;
}

function extractCountry(request: NextRequest): string {
  const country = request.headers.get("x-vercel-ip-country");
  if (country && /^[A-Z]{2}$/.test(country)) return country;
  return FALLBACK_COUNTRY;
}

function isFreshSealed(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as SealedContext;
    if (typeof parsed.ts !== "number") return false;
    const age = Date.now() - parsed.ts;
    // Re-issue once per hour so the timestamp never goes stale enough to be
    // rejected by Convex (which allows up to 24h).
    return age >= 0 && age < 60 * 60 * 1000;
  } catch {
    return false;
  }
}

async function sign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(payload) as BufferSource
  );
  return bytesToBase64(new Uint8Array(sig));
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export const config = {
  // Skip Next.js internals and static assets — they don't issue mutations.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"],
};
