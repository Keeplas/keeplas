import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import { makeT, seedUser, asUser, signedAudit } from "./test.helpers";

describe("audit chain (SHA-256)", () => {
  it("appends a SHA-256-hashed, chained entry per audited mutation", async () => {
    const t = makeT();
    const userId = await seedUser(t);

    // `totp.disable` is an audited mutation guarded only by `requireAuth`, so
    // it exercises the wrapper without the step-up gates. The wrapper appends
    // an entry even when the handler is a no-op (no TOTP row).
    await asUser(t, userId).mutation(api.totp.disable, {
      _audit: await signedAudit(),
    });
    await asUser(t, userId).mutation(api.totp.disable, {
      _audit: await signedAudit(),
    });

    const logs = await t.run((ctx) =>
      ctx.db
        .query("audit_logs")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("asc")
        .collect(),
    );

    expect(logs).toHaveLength(2);

    for (const log of logs) {
      // SHA-256 hex digest (64 chars) — the legacy 32-bit hash was 8 chars.
      expect(log.logHash).toMatch(/^[0-9a-f]{64}$/);
      expect(log.action).toBe("totp_disabled");
      // IP / country are attested from the verified `_audit` envelope.
      expect(log.ipAddress).toBe("127.0.0.1");
      expect(log.country).toBe("FR");
    }

    // Chain linkage: first links to genesis, second links to the first.
    expect(logs[0].previousLogHash).toBe("genesis");
    expect(logs[1].previousLogHash).toBe(logs[0].logHash);
    // The chain advances — distinct entries hash differently.
    expect(logs[0].logHash).not.toBe(logs[1].logHash);
  });
});
