// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSealCookie,
  extractClientInfo,
  readFreshContext,
  sealContext,
} from "../audit-context";

const SECRET = "test-keeplas-ctx-secret-0123456789";
const APP = "https://app.keeplas.com/hub";

function request(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

function cookieHeader(name: string, value: unknown): string {
  return `${name}=${encodeURIComponent(JSON.stringify(value))}`;
}

describe("readFreshContext", () => {
  beforeEach(() => {
    vi.stubEnv("KEEPLAS_TRUSTED_PROXY", "");
    vi.stubEnv("VERCEL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("treats a malformed cookie as missing instead of throwing", async () => {
    const req = request(APP, { cookie: "__Host-keeplas_ctx=%E0%A4%A" });
    await expect(readFreshContext(req, SECRET)).resolves.toBeNull();
  });

  it("returns a fresh context it sealed itself", async () => {
    const sealed = await sealContext(request(APP), SECRET);
    const req = request(APP, {
      cookie: cookieHeader("__Host-keeplas_ctx", sealed),
    });
    await expect(readFreshContext(req, SECRET)).resolves.toEqual(sealed);
  });

  it("rejects a context whose signature does not match", async () => {
    const sealed = await sealContext(request(APP), SECRET);
    const forged = { ...sealed, ip: "203.0.113.9" };
    const req = request(APP, {
      cookie: cookieHeader("__Host-keeplas_ctx", forged),
    });
    await expect(readFreshContext(req, SECRET)).resolves.toBeNull();
  });

  it("drops fields the seal does not cover", async () => {
    const sealed = await sealContext(request(APP), SECRET);
    const req = request(APP, {
      cookie: cookieHeader("__Host-keeplas_ctx", { ...sealed, extra: 1 }),
    });
    await expect(readFreshContext(req, SECRET)).resolves.toEqual(sealed);
  });

  it("rejects a context older than an hour", async () => {
    vi.useFakeTimers();
    const sealed = await sealContext(request(APP), SECRET);
    vi.advanceTimersByTime(60 * 60 * 1000);
    const req = request(APP, {
      cookie: cookieHeader("__Host-keeplas_ctx", sealed),
    });
    await expect(readFreshContext(req, SECRET)).resolves.toBeNull();
  });

  it("ignores the unprefixed name a sibling subdomain could toss", async () => {
    const sealed = await sealContext(request(APP), SECRET);
    const req = request(APP, {
      cookie: cookieHeader("__keeplas_ctx", sealed),
    });
    await expect(readFreshContext(req, SECRET)).resolves.toBeNull();
  });
});

describe("buildSealCookie", () => {
  it("binds the cookie to this host with the __Host- prefix", async () => {
    const req = request(APP);
    const cookie = buildSealCookie(req, await sealContext(req, SECRET));
    expect(cookie.startsWith("__Host-keeplas_ctx=")).toBe(true);
    expect(cookie).toContain("; Secure");
    expect(cookie).toContain("; Path=/");
    expect(cookie).toContain("; HttpOnly");
    expect(cookie).not.toContain("Domain=");
  });

  it("keeps a plain cookie for http://localhost (dev), readable back", async () => {
    const req = request("http://localhost:3000/hub");
    const sealed = await sealContext(req, SECRET);
    const cookie = buildSealCookie(req, sealed);
    expect(cookie.startsWith("__keeplas_ctx=")).toBe(true);
    expect(cookie).not.toContain("Secure");
    const back = request("http://localhost:3000/api/context", {
      cookie: cookie.split(";")[0]!,
    });
    await expect(readFreshContext(back, SECRET)).resolves.toEqual(sealed);
  });
});

describe("extractClientInfo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("on Vercel, trusts only Vercel's headers, never client cf-* ones", () => {
    vi.stubEnv("VERCEL", "1");
    const info = extractClientInfo(
      request(APP, {
        "x-real-ip": "198.51.100.7",
        "x-forwarded-for": "198.51.100.7",
        "cf-ipcountry": "FR",
        "cf-ipcity": "Paris",
      }),
    );
    expect(info).toEqual({ ip: "198.51.100.7", country: "XX" });
  });

  it("on Vercel, reads its geo headers", () => {
    vi.stubEnv("VERCEL", "1");
    const info = extractClientInfo(
      request(APP, {
        "x-real-ip": "198.51.100.7",
        "x-vercel-ip-country": "BE",
        "x-vercel-ip-city": "Li%C3%A8ge",
      }),
    );
    expect(info).toEqual({ ip: "198.51.100.7", country: "BE", city: "Liège" });
  });

  it("behind Cloudflare, uses CF-Connecting-IP and Cloudflare geo", () => {
    vi.stubEnv("KEEPLAS_TRUSTED_PROXY", "cloudflare");
    const info = extractClientInfo(
      request(APP, {
        "cf-connecting-ip": "2001:db8::1",
        "x-forwarded-for": "203.0.113.1, 2001:db8::1",
        "cf-ipcountry": "CA",
        "cf-ipcity": "Montreal",
      }),
    );
    expect(info).toEqual({
      ip: "2001:db8::1",
      country: "CA",
      city: "Montreal",
    });
  });

  it("elsewhere, takes the hop the nearest proxy appended, not the client's", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("KEEPLAS_TRUSTED_PROXY", "");
    const info = extractClientInfo(
      request(APP, {
        "x-forwarded-for": "203.0.113.50, 198.51.100.7",
        "x-vercel-ip-country": "FR",
      }),
    );
    expect(info).toEqual({ ip: "198.51.100.7", country: "XX" });
  });

  it("never seals a value that is not an IP address", () => {
    vi.stubEnv("VERCEL", "1");
    const info = extractClientInfo(
      request(APP, { "x-real-ip": "evil|FR|123" }),
    );
    expect(info.ip).toBe("0.0.0.0");
  });
});
