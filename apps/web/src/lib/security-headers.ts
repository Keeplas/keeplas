/**
 * Security headers for the Keeplas web app.
 *
 * Keeplas is zero-knowledge: the browser performs all crypto (Argon2id via
 * `hash-wasm`, ML-KEM, AES) and talks only to Convex. A strict
 * Content-Security-Policy plus the standard hardening headers shrink the
 * attack surface (XSS, clickjacking, MIME sniffing, referrer leakage).
 *
 * The CSP is nonce-based: the request middleware (src/start.ts) draws a fresh
 * nonce per response and hands it to TanStack Router (src/router.tsx), which
 * stamps it on the scripts the framework itself emits. Nothing else in the
 * document is allow-listed, so markup injected into the HTML stays inert.
 * Every other script is bundled by Vite and served same-origin (`'self'`).
 *
 * WASM note: `hash-wasm` compiles/instantiates a WebAssembly module at
 * runtime, which the CSP treats as script execution. `'wasm-unsafe-eval'`
 * permits exactly that (WASM compile) WITHOUT re-enabling `eval()` for JS.
 * `worker-src ... blob:` covers any worker the WASM glue may spawn from a
 * blob URL. Dropping either would break key derivation on login/unlock.
 */

/**
 * True only under `vite dev`: TanStack Start defines `TSS_DEV_SERVER` from the
 * Vite command. NODE_ENV is not a safe signal: a `.env` file holding
 * `NODE_ENV=development` makes `vite build` fold "development" into the
 * production bundle.
 */
export function isDevServer(): boolean {
  return process.env.TSS_DEV_SERVER === "true";
}

/**
 * Origins of the configured Convex deployment (`https:` + `wss:`, or `http:` +
 * `ws:` for a local self-hosted backend). Any `*.convex.cloud` host would let
 * an injected script send data to a deployment anyone can create, so the
 * wildcard is only a fallback for the dev server without a URL.
 */
function convexSources(): string[] {
  try {
    const { protocol, host } = new URL(
      process.env.NEXT_PUBLIC_CONVEX_URL ?? "",
    );
    if (protocol === "https:") return [`https://${host}`, `wss://${host}`];
    if (protocol === "http:") return [`http://${host}`, `ws://${host}`];
  } catch {
    // Unset or malformed: the app cannot reach Convex anyway.
  }
  return isDevServer()
    ? ["https://*.convex.cloud", "wss://*.convex.cloud"]
    : [];
}

/**
 * Builds the Content-Security-Policy value. `scriptNonce` is the per-response
 * nonce the router stamps on its own scripts. Pure function so it can be
 * unit-tested without a request context.
 */
export function buildContentSecurityPolicy(scriptNonce?: string): string {
  const convex = convexSources();
  const scriptSrc = ["'self'", "'wasm-unsafe-eval'"];
  if (isDevServer()) {
    // Dev server only: Vite/HMR + React Refresh inject inline scripts without
    // the nonce and rely on eval(). No nonce here: browsers ignore
    // 'unsafe-inline' as soon as a nonce is present.
    scriptSrc.push("'unsafe-inline'", "'unsafe-eval'");
  } else if (scriptNonce) {
    scriptSrc.push(`'nonce-${scriptNonce}'`);
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'wasm-unsafe-eval' is required by hash-wasm (Argon2id). Inline framework
    // scripts carry the response nonce; bundled scripts are same-origin,
    // covered by 'self'.
    "script-src": scriptSrc,
    // Chrome reports blocked <script> elements against script-src-elem. Keep it
    // explicit so the nonce applies consistently to framework scripts.
    "script-src-elem": scriptSrc,
    // Tailwind / Vite inject runtime <style> tags; hashing them is impractical.
    "style-src": ["'self'", "'unsafe-inline'"],
    "connect-src": ["'self'", ...convex],
    // Convex storage serves uploaded avatars as plain <img> URLs (vault
    // attachments are decrypted into blob: URLs instead).
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      ...convex.filter((source) => source.startsWith("http")),
    ],
    // Decrypted vault attachments (audio/video) are played from in-memory
    // `blob:` object URLs. Without an explicit media-src the browser falls back
    // to default-src ('self') and refuses the blob, so the player stays stuck at
    // 0:00. Decryption happens client-side — the blob never leaves the page.
    "media-src": ["'self'", "blob:"],
    // Vite inlines small font files (under build.assetsInlineLimit) into the CSS
    // bundle as `data:font/woff2;base64,...`, so `data:` is required for those.
    // A font is inert (cannot execute script), so this does not weaken the CSP.
    "font-src": ["'self'", "data:"],
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
 * Builds the full set of security headers (CSP + hardening headers) for a
 * document whose framework scripts carry `scriptNonce`. Pure and order-stable
 * so it is straightforward to assert in tests. The caller applies these to the
 * response.
 */
export function buildSecurityHeaders(
  scriptNonce?: string,
): Record<string, string> {
  return {
    "Content-Security-Policy": buildContentSecurityPolicy(scriptNonce),
    // Defines the `csp-endpoint` group referenced by the CSP `report-to`
    // directive. Same-origin collector route logs violations server-side.
    "Reporting-Endpoints": 'csp-endpoint="/api/csp-report"',
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    // Disable everything the app never uses. camera/microphone are kept at
    // (self) so same-origin audio/video recording (add-item-dialog vault items)
    // works while staying blocked in cross-origin iframes.
    // publickey-credentials-get=(self) is kept so WebAuthn (PRF unlock with
    // biometric / hardware key) works.
    "Permissions-Policy": [
      "camera=(self)",
      "microphone=(self)",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "publickey-credentials-get=(self)",
    ].join(", "),
    // Legacy clickjacking defense; superseded by frame-ancestors but harmless.
    "X-Frame-Options": "DENY",
    // A cross-origin page that opens the app keeps no handle on its window
    // (no tab swap to a lookalike, fewer XS-Leaks), and no other origin can
    // embed the document as a resource. WebAuthn is unaffected.
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}
