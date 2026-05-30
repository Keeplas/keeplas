/**
 * Security headers for the Keeplas web app.
 *
 * Keeplas is zero-knowledge: the browser performs all crypto (Argon2id via
 * `hash-wasm`, ML-KEM, AES) and talks only to Convex. A strict
 * Content-Security-Policy plus the standard hardening headers shrink the
 * attack surface (XSS, clickjacking, MIME sniffing, referrer leakage).
 *
 * The CSP is nonce-based: the middleware generates a fresh nonce per request
 * and passes it here. Next.js injects that nonce onto its own framework
 * scripts when it sees `'nonce-...'` in `script-src`, so no inline scripts
 * need `'unsafe-inline'`.
 *
 * WASM note: `hash-wasm` compiles/instantiates a WebAssembly module at
 * runtime, which the CSP treats as script execution. `'wasm-unsafe-eval'`
 * permits exactly that (WASM compile) WITHOUT re-enabling `eval()` for JS.
 * `worker-src ... blob:` covers any worker the WASM glue may spawn from a
 * blob URL. Dropping either would break key derivation on login/unlock.
 */

/** Convex URL used to scope `connect-src`; falls back to the wildcard host. */
function convexConnectSources(): string[] {
  const sources = ["https://*.convex.cloud", "wss://*.convex.cloud"];
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (url) {
    try {
      const origin = new URL(url).origin;
      if (!sources.includes(origin)) sources.unshift(origin);
    } catch {
      // Malformed URL — rely on the wildcard hosts above.
    }
  }
  return sources;
}

/**
 * Builds the Content-Security-Policy value for a given per-request nonce.
 * Pure function so it can be unit-tested without a request context.
 */
export function buildContentSecurityPolicy(nonce: string): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'wasm-unsafe-eval' is required by hash-wasm (Argon2id). 'strict-dynamic'
    // lets Next's nonced loader pull in its chunked scripts.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
    ],
    // Tailwind / Next inject runtime <style> tags; hashing them is impractical.
    "style-src": ["'self'", "'unsafe-inline'"],
    "connect-src": ["'self'", ...convexConnectSources()],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    // blob: for any worker the WASM glue spawns.
    "worker-src": ["'self'", "blob:"],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Builds the full set of security headers (CSP + hardening headers) for a
 * given nonce. Pure and order-stable so it is straightforward to assert in
 * tests. The caller is responsible for applying these to the response.
 */
export function buildSecurityHeaders(nonce: string): Record<string, string> {
  return {
    "Content-Security-Policy": buildContentSecurityPolicy(nonce),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    // Disable everything the app never uses. publickey-credentials-get=(self)
    // is kept so WebAuthn (PRF unlock with biometric / hardware key) works.
    "Permissions-Policy": [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "publickey-credentials-get=(self)",
    ].join(", "),
    // Legacy clickjacking defense; superseded by frame-ancestors but harmless.
    "X-Frame-Options": "DENY",
  };
}
