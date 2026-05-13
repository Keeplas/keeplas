import { NextRequest, NextResponse } from "next/server";
import { uint8ToBase64 } from "@keeplas/crypto/encoding";

/**
 * Cookie name carrying the sealed audit context. HttpOnly + SameSite=Strict
 * so it only travels server-to-server (read by `/api/context`) — the browser
 * never touches it directly.
 */
const COOKIE_NAME = "__keeplas_ctx";
const COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;
const REQUEST_ID_HEADER = "x-request-id";

const FALLBACK_IP = "0.0.0.0";
const FALLBACK_COUNTRY = "XX";

let warnedAboutMissingSecret = false;

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
 *
 * Also stamps an `x-request-id` on every request/response pair so logs from
 * the client, the Next.js server, and Convex can be correlated when a user
 * reports an issue. We honour an inbound `x-request-id` (e.g. from a CDN or
 * a tracing client) when present.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const requestId =
    request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(REQUEST_ID_HEADER, requestId);

  const secret = process.env.KEEPLAS_CTX_SECRET;
  if (!secret) {
    // No secret configured — skip cookie issuance. Mutations will fail closed
    // when they try to verify a missing/invalid context, which is the correct
    // behavior in production. `pnpm check:env` is the real gate; this warning
    // is the safety net for "secret unset while dev server is running".
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      console.error(
        "[middleware] KEEPLAS_CTX_SECRET is not set — audited mutations will fail. " +
          "Add it to .env.local and restart the dev server.",
      );
    }
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
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(payload) as BufferSource,
  );
  return uint8ToBase64(new Uint8Array(sig));
}

export const config = {
  // Skip Next.js internals and static assets — they don't issue mutations.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"],
};
