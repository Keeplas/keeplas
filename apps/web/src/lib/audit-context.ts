import { uint8ToBase64 } from "@keeplas/crypto/encoding";

/**
 * Server side of the audit envelope (used only by the request middleware,
 * src/start.ts): the HMAC-sealed `ip|country|ts[|city]` that every audited
 * Convex mutation re-verifies (packages/convex/audit.ts). It travels in an
 * HttpOnly cookie and is handed back to the client by `GET /api/context`.
 */

export interface SealedContext {
  ip: string;
  country: string;
  ts: number;
  sig: string;
  city?: string;
}

interface ClientInfo {
  ip: string;
  country: string;
  city?: string;
}

const COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;
// Re-issue once per hour so the timestamp never goes stale enough to be
// rejected by Convex (which allows up to 24h).
const FRESH_FOR_MS = 60 * 60 * 1000;
const FALLBACK_IP = "0.0.0.0";
const FALLBACK_COUNTRY = "XX";

// `__Host-` pins the cookie to this exact host (Secure, Path=/, no Domain), so
// a page on a sibling *.keeplas.com host cannot plant one. Plain-HTTP
// localhost (dev) cannot hold Secure cookies in every browser, so it keeps the
// unprefixed name, which a production host never reads.
const HOST_COOKIE = "__Host-keeplas_ctx";
const LOCAL_COOKIE = "__keeplas_ctx";

function isLocalhost(request: Request): boolean {
  const { hostname } = new URL(request.url);
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

function cookieName(request: Request): string {
  return isLocalhost(request) ? LOCAL_COOKIE : HOST_COOKIE;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key !== name) continue;
    try {
      return decodeURIComponent(value.join("="));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Whose client-IP and geo headers to trust. Vercel (which sets `VERCEL` in
 * its functions) overwrites its own headers; behind Cloudflare set
 * KEEPLAS_TRUSTED_PROXY=cloudflare. Anywhere else, only the hop the nearest
 * reverse proxy appended to X-Forwarded-For, and no geo: every other header
 * is whatever the client sent.
 */
function trustedProxy(): "vercel" | "cloudflare" | null {
  const configured = process.env.KEEPLAS_TRUSTED_PROXY;
  if (configured === "vercel" || configured === "cloudflare") return configured;
  return process.env.VERCEL ? "vercel" : null;
}

function lastHop(value: string | null): string | undefined {
  return value?.split(",").at(-1)?.trim() || undefined;
}

function isIpAddress(value: string): boolean {
  return (
    /^\d{1,3}(\.\d{1,3}){3}$/.test(value) ||
    (value.length <= 45 && value.includes(":") && /^[\da-f:.]+$/i.test(value))
  );
}

function cleanCity(raw: string | null): string | undefined {
  if (!raw) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return undefined;
  }
  const clean = Array.from(decoded)
    .filter((char) => char >= " " && char !== "\u007f" && char !== "|")
    .join("")
    .trim()
    .slice(0, 80);
  return clean || undefined;
}

/** The request's client IP, country and city, from trusted headers only. */
export function extractClientInfo(request: Request): ClientInfo {
  const headers = request.headers;
  const proxy = trustedProxy();
  const ip =
    proxy === "vercel"
      ? (headers.get("x-real-ip") ?? lastHop(headers.get("x-forwarded-for")))
      : proxy === "cloudflare"
        ? headers.get("cf-connecting-ip")
        : (lastHop(headers.get("x-forwarded-for")) ??
          headers.get("x-real-ip"));
  const geo =
    proxy === "vercel"
      ? {
          country: headers.get("x-vercel-ip-country"),
          city: headers.get("x-vercel-ip-city"),
        }
      : proxy === "cloudflare"
        ? { country: headers.get("cf-ipcountry"), city: headers.get("cf-ipcity") }
        : { country: null, city: null };
  const info: ClientInfo = {
    ip: ip && isIpAddress(ip) ? ip : FALLBACK_IP,
    country:
      geo.country && /^[A-Z]{2}$/.test(geo.country)
        ? geo.country
        : FALLBACK_COUNTRY,
  };
  const city = cleanCity(geo.city);
  return city ? { ...info, city } : info;
}

function sealedPayload({ ip, country, ts, city }: Omit<SealedContext, "sig">) {
  return city === undefined
    ? `${ip}|${country}|${ts}`
    : `${ip}|${country}|${ts}|${city}`;
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

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** The sealed fields of `value`, or null when it does not have their shape. */
function asSealedContext(value: unknown): SealedContext | null {
  if (typeof value !== "object" || value === null) return null;
  const { ip, country, ts, sig, city } = value as Record<string, unknown>;
  if (
    typeof ip !== "string" ||
    typeof country !== "string" ||
    typeof ts !== "number" ||
    typeof sig !== "string" ||
    (city !== undefined && typeof city !== "string")
  ) {
    return null;
  }
  return city === undefined
    ? { ip, country, ts, sig }
    : { ip, country, ts, sig, city };
}

/**
 * The context sealed in this request's cookie when it is ours (valid HMAC),
 * fresh, and well formed. Anything else counts as missing.
 */
export async function readFreshContext(
  request: Request,
  secret: string,
): Promise<SealedContext | null> {
  const raw = readCookie(request, cookieName(request));
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const sealed = asSealedContext(parsed);
  if (!sealed) return null;
  const age = Date.now() - sealed.ts;
  if (age < 0 || age >= FRESH_FOR_MS) return null;
  const expected = await sign(sealedPayload(sealed), secret);
  return constantTimeEquals(expected, sealed.sig) ? sealed : null;
}

/** HMAC-seal the request's IP + country (+ city) for audited mutations. */
export async function sealContext(
  request: Request,
  secret: string,
): Promise<SealedContext> {
  const unsigned = { ...extractClientInfo(request), ts: Date.now() };
  return { ...unsigned, sig: await sign(sealedPayload(unsigned), secret) };
}

/** `Set-Cookie` value carrying `sealed` for this request's host. */
export function buildSealCookie(
  request: Request,
  sealed: SealedContext,
): string {
  const attrs = [
    `${cookieName(request)}=${encodeURIComponent(JSON.stringify(sealed))}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (!isLocalhost(request)) attrs.push("Secure");
  return attrs.join("; ");
}
