/**
 * Security headers for the Keeplas web app.
 *
 * Keeplas is zero-knowledge: the browser performs all crypto (Argon2id via
 * `hash-wasm`, ML-KEM, AES) and talks only to Convex. A strict
 * Content-Security-Policy plus the standard hardening headers shrink the
 * attack surface (XSS, clickjacking, MIME sniffing, referrer leakage).
 *
 * The CSP is hash-based: the request middleware (src/start.ts) computes the
 * SHA-256 hash of every inline `<script>` in the rendered document and passes
 * the `'sha256-...'` tokens here. Every other script is bundled by Vite and
 * served same-origin, so `'self'` covers it — no inline script ever needs
 * `'unsafe-inline'`.
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
 * Builds the Content-Security-Policy value. `scriptHashes` are the
 * `'sha256-...'` tokens for the inline scripts present in the rendered
 * document (computed per response by the request middleware). Pure function so
 * it can be unit-tested without a request context.
 */
export function buildContentSecurityPolicy(
  scriptHashes: string[] = [],
): string {
  // React's dev build (and Vite HMR) uses eval() for debugging features like
  // reconstructing call stacks. Allow it ONLY in development — production never
  // relies on eval(), so the strict policy stays intact.
  const scriptSrc = ["'self'", "'wasm-unsafe-eval'", ...scriptHashes];
  if (process.env.NODE_ENV === "development") {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'wasm-unsafe-eval' is required by hash-wasm (Argon2id). Inline framework
    // scripts are allow-listed by their SHA-256 hash; bundled scripts are
    // same-origin, covered by 'self'.
    "script-src": scriptSrc,
    // Tailwind / Vite inject runtime <style> tags; hashing them is impractical.
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
    // Surface violations so an injection attempt or a broken third-party shows
    // up in our logs. `report-to` is the modern channel (group defined by the
    // `Reporting-Endpoints` header below); `report-uri` is the legacy fallback
    // still honored by browsers that ignore `report-to`.
    "report-to": ["csp-endpoint"],
    "report-uri": ["/api/csp-report"],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Builds the full set of security headers (CSP + hardening headers) for the
 * given inline-script SHA-256 hashes. Pure and order-stable so it is
 * straightforward to assert in tests. The caller applies these to the response.
 */
export function buildSecurityHeaders(
  scriptHashes: string[] = [],
): Record<string, string> {
  return {
    "Content-Security-Policy": buildContentSecurityPolicy(scriptHashes),
    // Defines the `csp-endpoint` group referenced by the CSP `report-to`
    // directive. Same-origin collector route logs violations server-side.
    "Reporting-Endpoints": 'csp-endpoint="/api/csp-report"',
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
