import { createMiddleware, createStart } from "@tanstack/react-start";
import { uint8ToBase64 } from "@keeplas/crypto/encoding";
import {
  buildSealCookie,
  readFreshContext,
  sealContext,
} from "@/lib/audit-context";
import { handleCspReport } from "@/lib/csp-report";
import { buildSecurityHeaders } from "@/lib/security-headers";
import { wellKnownResponse } from "@/lib/well-known";

/**
 * Server request pipeline for the Keeplas web app (TanStack Start).
 *
 * Replaces the old Next.js `middleware.ts` + `/api/*` route handlers:
 *  - issues the sealed audit cookie (HMAC-SHA256 over `ip|country|ts`,
 *    re-verified server-side by Convex mutations, see lib/audit-context.ts),
 *  - stamps every request/response with `x-request-id` for log correlation,
 *  - applies the full security-header set (CSP + hardening) to HTML documents,
 *    with a per-response script nonce that only the router's own scripts carry
 *    (src/router.tsx reads it from the request context),
 *  - serves the two tiny endpoints the client still calls over HTTP:
 *    `GET /api/context` (hand the sealed cookie back to the React tree) and
 *    `POST /api/csp-report` (CSP violation collector).
 */

const REQUEST_ID_HEADER = "x-request-id";

let warnedAboutMissingSecret = false;

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return uint8ToBase64(bytes);
}

const securityMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, pathname, next }) => {
    const method = request.method.toUpperCase();

    // ── /.well-known app association files (Universal / App Links). ──
    // HEAD too, so `curl -I` and link validators don't get the SPA's 404.
    if (method === "GET" || method === "HEAD") {
      const wellKnown = wellKnownResponse(pathname, process.env);
      if (wellKnown) return wellKnown;
    }

    // ── GET /api/context — hand the sealed context back to the client. ──
    // Browsers get their cookie back; native apps (no cookie jar) get a
    // freshly sealed context for the request's IP and country.
    if (pathname === "/api/context" && method === "GET") {
      const secret = process.env.KEEPLAS_CTX_SECRET;
      if (!secret) return new Response(null, { status: 204 });
      const sealed =
        (await readFreshContext(request, secret)) ??
        (await sealContext(request, secret));
      return Response.json(sealed, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    // ── POST /api/csp-report — CSP violation collector (always 204). ──
    if (pathname === "/api/csp-report" && method === "POST") {
      return handleCspReport(request);
    }

    const requestId =
      request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();

    const cspNonce = randomNonce();
    const result = await next({ context: { cspNonce } });
    const response = result.response;
    response.headers.set(REQUEST_ID_HEADER, requestId);

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      // Assets / server-function responses: no inline script, no CSP.
      return result;
    }

    // The document is left untouched (it may be a stream): only the scripts
    // the router stamped with `cspNonce` run, so markup injected into the
    // HTML never inherits an allow-listing.
    for (const [name, value] of Object.entries(
      buildSecurityHeaders(cspNonce),
    )) {
      response.headers.set(name, value);
    }
    // Issue / refresh the sealed audit cookie on the document response.
    const cookie = await maybeSealCookie(request);
    if (cookie) response.headers.append("Set-Cookie", cookie);
    return result;
  },
);

/** Build a fresh sealed audit cookie when one is missing/stale, else null. */
async function maybeSealCookie(request: Request): Promise<string | null> {
  const secret = process.env.KEEPLAS_CTX_SECRET;
  if (!secret) {
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      console.error(
        "[start] KEEPLAS_CTX_SECRET is not set — audited mutations will fail. " +
          "Add it to .env.local and restart the dev server.",
      );
    }
    return null;
  }
  if (await readFreshContext(request, secret)) return null;
  return buildSealCookie(request, await sealContext(request, secret));
}

export const startInstance = createStart(() => ({
  requestMiddleware: [securityMiddleware],
}));
