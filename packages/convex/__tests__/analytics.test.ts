import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { asUser, makeT, seedUser, signedAudit } from "./test.helpers";

describe("analytics.track", () => {
  it("records a page_view with server-attested ip/country for a logged-out visitor", async () => {
    const t = makeT();
    await t.mutation(api.analytics.track, {
      eventType: "page_view",
      route: "/_auth/login",
      _audit: await signedAudit(),
    });

    const events = await t.run((ctx) =>
      ctx.db.query("analytics_events").collect(),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "page_view",
      route: "/_auth/login",
      ipAddress: "127.0.0.1",
      country: "FR",
    });
    // No user is attached for a logged-out visitor.
    expect(events[0].userId).toBeUndefined();
  });

  it("stamps userId + lastSeenAt heartbeat when authenticated and stale", async () => {
    const t = makeT();
    const userId = await seedUser(t);

    await asUser(t, userId).mutation(api.analytics.track, {
      eventType: "page_view",
      route: "/_dashboard/vault",
      _audit: await signedAudit(),
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.lastSeenAt).toBeGreaterThan(0);
    const [event] = await t.run((ctx) =>
      ctx.db.query("analytics_events").collect(),
    );
    expect(event.userId).toBe(userId);
  });

  it("throttles the heartbeat — a recent lastSeenAt is not overwritten", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const recent = Date.now() - 1000; // within the 5-min throttle window
    await t.run((ctx) => ctx.db.patch(userId, { lastSeenAt: recent }));

    await asUser(t, userId).mutation(api.analytics.track, {
      eventType: "page_view",
      route: "/_dashboard",
      _audit: await signedAudit(),
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.lastSeenAt).toBe(recent);
  });
});

describe("admin guard", () => {
  it("whoami rejects a non-admin and returns identity for an admin", async () => {
    const t = makeT();
    const normal = await seedUser(t);
    await expect(
      asUser(t, normal).query(api.admin.access.whoami, {}),
    ).rejects.toThrow("FORBIDDEN");

    const admin = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Ada",
        email: "ada@keeplas.com",
        role: "admin",
      }),
    );
    const who = await asUser(t, admin).query(api.admin.access.whoami, {});
    expect(who).toEqual({ name: "Ada", email: "ada@keeplas.com" });
  });

  it("an aggregation query is gated behind requireAdmin", async () => {
    const t = makeT();
    const normal = await seedUser(t);
    await expect(
      asUser(t, normal).query(api.admin.users.riskSegments, {}),
    ).rejects.toThrow("FORBIDDEN");

    const admin = await t.run((ctx) =>
      ctx.db.insert("users", { role: "admin" }),
    );
    const segments = await asUser(t, admin).query(
      api.admin.users.riskSegments,
      {},
    );
    // The admin user itself has no contacts / items / config.
    expect(segments.noTrustedContacts).toBeGreaterThanOrEqual(1);
    expect(segments).toHaveProperty("noVaultItems");
    expect(segments).toHaveProperty("lifeCheckNeverReset");
    expect(segments).toHaveProperty("incompleteOnboarding");
  });
});
