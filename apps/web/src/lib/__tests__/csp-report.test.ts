// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleCspReport } from "../csp-report";

function post(body: string, headers: Record<string, string> = {}) {
  return new Request("https://app.keeplas.com/api/csp-report", {
    method: "POST",
    headers: { "content-type": "application/csp-report", ...headers },
    body,
  });
}

const LEGACY_REPORT = {
  "csp-report": {
    "document-uri": "https://app.keeplas.com/life-check/confirm?token=secret",
    "effective-directive": "script-src-elem",
    "blocked-uri": "https://evil.example/x.js?k=1",
    disposition: "enforce",
  },
};

describe("handleCspReport", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // Each test starts in a fresh logging window.
    vi.advanceTimersByTime(10 * 60 * 1000);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    vi.useRealTimers();
  });

  it("always acknowledges with 204", async () => {
    const res = await handleCspReport(post("not json"));
    expect(res.status).toBe(204);
  });

  it("logs only the directive, blocked origin and document path", async () => {
    await handleCspReport(post(JSON.stringify(LEGACY_REPORT)));
    expect(warn).toHaveBeenCalledTimes(1);
    const line = JSON.stringify(warn.mock.calls[0]);
    expect(line).toContain("script-src-elem");
    expect(line).toContain("https://evil.example");
    expect(line).toContain("/life-check/confirm");
    expect(line).not.toContain("token=secret");
    expect(line).not.toContain("k=1");
  });

  it("reads Reporting API batches", async () => {
    const batch = [
      {
        type: "csp-violation",
        body: {
          documentURL: "https://app.keeplas.com/hub",
          effectiveDirective: "connect-src",
          blockedURL: "wss://attacker.convex.cloud/api/sync",
        },
      },
    ];
    await handleCspReport(post(JSON.stringify(batch)));
    const line = JSON.stringify(warn.mock.calls[0]);
    expect(line).toContain("connect-src");
    expect(line).toContain("wss://attacker.convex.cloud");
  });

  it("logs at most a few reports per request", async () => {
    const batch = Array.from({ length: 50 }, () => LEGACY_REPORT);
    await handleCspReport(post(JSON.stringify(batch)));
    expect(warn).toHaveBeenCalledTimes(10);
  });

  it("ignores an oversized body", async () => {
    const huge = JSON.stringify(Array.from({ length: 10_000 }, () => ({})));
    const res = await handleCspReport(post(huge));
    expect(res.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("caps the log volume across requests", async () => {
    for (let i = 0; i < 200; i++) {
      await handleCspReport(post(JSON.stringify(LEGACY_REPORT)));
    }
    expect(warn.mock.calls.length).toBeLessThanOrEqual(60);
  });
});
