import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "./security-headers";

const NONCE = "test-nonce-abc123";

describe("buildContentSecurityPolicy", () => {
  const originalConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
  });

  afterEach(() => {
    if (originalConvexUrl === undefined) {
      delete process.env.NEXT_PUBLIC_CONVEX_URL;
    } else {
      process.env.NEXT_PUBLIC_CONVEX_URL = originalConvexUrl;
    }
  });

  it("embeds the per-request nonce in script-src", () => {
    const csp = buildContentSecurityPolicy(NONCE);
    expect(csp).toContain(`'nonce-${NONCE}'`);
  });

  it("allows WASM execution required by hash-wasm (Argon2id)", () => {
    const csp = buildContentSecurityPolicy(NONCE);
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).toMatch(/worker-src [^;]*blob:/);
  });

  it("locks down dangerous directives", () => {
    const csp = buildContentSecurityPolicy(NONCE);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it("never permits unsafe-eval (only the scoped wasm variant)", () => {
    const csp = buildContentSecurityPolicy(NONCE);
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("always scopes connect-src to the Convex wildcard hosts", () => {
    const csp = buildContentSecurityPolicy(NONCE);
    expect(csp).toContain("https://*.convex.cloud");
    expect(csp).toContain("wss://*.convex.cloud");
  });

  it("adds the configured Convex origin to connect-src when present", () => {
    process.env.NEXT_PUBLIC_CONVEX_URL =
      "https://energetic-pony-179.convex.cloud";
    const csp = buildContentSecurityPolicy(NONCE);
    expect(csp).toContain("https://energetic-pony-179.convex.cloud");
  });

  it("ignores a malformed Convex URL without throwing", () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "not a url";
    expect(() => buildContentSecurityPolicy(NONCE)).not.toThrow();
    const csp = buildContentSecurityPolicy(NONCE);
    expect(csp).toContain("https://*.convex.cloud");
  });
});

describe("buildSecurityHeaders", () => {
  it("returns the CSP plus all hardening headers", () => {
    const headers = buildSecurityHeaders(NONCE);
    expect(headers["Content-Security-Policy"]).toContain(`'nonce-${NONCE}'`);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("disables sensitive features but keeps WebAuthn get", () => {
    const headers = buildSecurityHeaders(NONCE);
    const policy = headers["Permissions-Policy"];
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
    expect(policy).toContain("publickey-credentials-get=(self)");
  });
});
