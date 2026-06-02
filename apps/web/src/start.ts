import { createMiddleware, createStart } from "@tanstack/react-start";
import { uint8ToBase64 } from "@keeplas/crypto/encoding";
import { buildSecurityHeaders } from "@/lib/security-headers";

/**
 * Server request pipeline for the Keeplas web app (TanStack Start).
 *
 * Replaces the old Next.js `middleware.ts` + `/api/*` route handlers:
 *  - issues the sealed `__keeplas_ctx` audit cookie (HMAC-SHA256 over
 *    `ip|country|ts`, re-verified server-side by Convex mutations),
 *  - stamps every request/response with `x-request-id` for log correlation,
 *  - applies the full security-header set (CSP + hardening) to HTML documents,
 *    computing the SHA-256 hash of every inline `<script>` so the strict CSP
 *    needs no `'unsafe-inline'`,
 *  - serves the two tiny endpoints the client still calls over HTTP:
 *    `GET /api/context` (hand the sealed cookie back to the React tree) and
 *    `POST /api/csp-report` (CSP violation collector).
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

function extractIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? FALLBACK_IP;
}

function extractCountry(request: Request): string {
  // Vercel sets `x-vercel-ip-country`; Cloudflare sets `cf-ipcountry`. Honor
  // whichever the host in front of us provides, else fall back.
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry");
  if (country && /^[A-Z]{2}$/.test(country)) return country;
  return FALLBACK_COUNTRY;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
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

/** SHA-256 (base64) of a string, formatted as a CSP `'sha256-...'` token. */
async function sha256Token(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text) as BufferSource,
  );
  return `'sha256-${uint8ToBase64(new Uint8Array(digest))}'`;
}

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

/** Hash every inline (src-less) <script> in the document for the CSP. */
async function hashInlineScripts(html: string): Promise<string[]> {
  const hashes: string[] = [];
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    const body = match[1];
    if (body && body.length > 0) hashes.push(await sha256Token(body));
  }
  return hashes;
}

function buildSealCookie(sealed: SealedContext): string {
  const value = encodeURIComponent(JSON.stringify(sealed));
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") attrs.push("Secure");
  return attrs.join("; ");
}

const securityMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, pathname, next }) => {
    const method = request.method.toUpperCase();

    // ── GET /api/context — hand the sealed cookie back to the client. ──
    if (pathname === "/api/context" && method === "GET") {
      const raw = readCookie(request, COOKIE_NAME);
      if (!raw) return new Response(null, { status: 204 });
      try {
        return Response.json(JSON.parse(raw), {
          headers: { "Cache-Control": "private, no-store" },
        });
      } catch {
        return new Response(null, { status: 204 });
      }
    }

    // ── POST /api/csp-report — CSP violation collector (always 204). ──
    if (pathname === "/api/csp-report" && method === "POST") {
      try {
        const body = await request.json();
        const reports = Array.isArray(body) ? body : [body];
        for (const report of reports) {
          console.warn("[csp-violation]", JSON.stringify(report));
        }
      } catch {
        // Malformed / empty body — nothing to log, still ack.
      }
      return new Response(null, { status: 204 });
    }

    const requestId =
      request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();

    const result = await next();
    const response = result.response;
    response.headers.set(REQUEST_ID_HEADER, requestId);

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      // Assets / server-function responses: nothing inline to hash, no CSP.
      return result;
    }

    // Read the document so we can hash its inline scripts for the CSP.
    const html = await response.text();
    const hashes = await hashInlineScripts(html);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(buildSecurityHeaders(hashes))) {
      headers.set(name, value);
    }

    // Issue / refresh the sealed audit cookie on the document response.
    const secret = process.env.KEEPLAS_CTX_SECRET;
    if (secret) {
      const existing = readCookie(request, COOKIE_NAME);
      if (!existing || !isFreshSealed(existing)) {
        const ip = extractIp(request);
        const country = extractCountry(request);
        const ts = Date.now();
        const sig = await sign(`${ip}|${country}|${ts}`, secret);
        headers.append("Set-Cookie", buildSealCookie({ ip, country, ts, sig }));
      }
    } else if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      console.error(
        "[start] KEEPLAS_CTX_SECRET is not set — audited mutations will fail. " +
          "Add it to .env.local and restart the dev server.",
      );
    }

    return new Response(html, { status: response.status, headers });
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [securityMiddleware],
}));
