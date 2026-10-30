import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  asUserSession,
  makeT,
  seedSession,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// Phase 4 (M08-4, M09-1, M09-2): devices, the new-device alert and
// "It wasn't me" (revoke device, end sessions, rotate keys).

async function signIn(t: TestConvex, userId: Id<"users">) {
  const sessionId = await seedSession(t, userId);
  return { sessionId, as: asUserSession(t, userId, sessionId) };
}

async function register(
  as: ReturnType<typeof asUserSession>,
  kind: "ios" | "android" | "web",
  label: string,
) {
  return as.mutation(api.devices.register, {
    kind,
    label,
    trusted: true,
    _audit: await signedAudit(),
  });
}

async function setup() {
  const t = makeT();
  const userId = await seedUser(t);
  const phone = await signIn(t, userId);
  const phoneId = await register(phone.as, "ios", "iPhone 15");
  const browser = await signIn(t, userId);
  const browserId = await register(browser.as, "web", "Chrome on macOS");
  return { t, userId, phone, phoneId, browser, browserId };
}

describe("devices", () => {
  it("lists active devices with a trimmed label", async () => {
    const { phone, browserId, phoneId } = await setup();
    const devices = await phone.as.query(api.devices.list, {});
    expect(devices.map((d) => d._id)).toEqual([browserId, phoneId]);
    expect(devices[0].label).toBe("Chrome on macOS");
  });

  it("hides a browser link whose session ended", async () => {
    const { t, phone, phoneId, browser } = await setup();
    // The browser signed out (or was linked again, which signs out first).
    await t.run((ctx) => ctx.db.delete(browser.sessionId));
    const devices = await phone.as.query(api.devices.list, {});
    expect(devices.map((d) => d._id)).toEqual([phoneId]);
  });

  it("hides a browser link whose session expired", async () => {
    const { t, phone, phoneId, browser } = await setup();
    await t.run((ctx) =>
      ctx.db.patch(browser.sessionId, { expirationTime: Date.now() - 1 }),
    );
    const devices = await phone.as.query(api.devices.list, {});
    expect(devices.map((d) => d._id)).toEqual([phoneId]);
  });

  it("keeps a signed-out browser that can come back with its passkey", async () => {
    const { t, userId, phone, phoneId, browser, browserId } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("passkey_credentials", {
        userId,
        credentialId: "browser-passkey",
        publicKey: "pk",
        counter: 0,
        deviceName: "Chrome",
        keeplasDeviceId: browserId,
        createdAt: 0,
        lastUsedAt: 0,
      });
      await ctx.db.delete(browser.sessionId);
    });
    const devices = await phone.as.query(api.devices.list, {});
    expect(devices.map((d) => d._id)).toEqual([browserId, phoneId]);
  });

  it("keeps a phone whose session ended", async () => {
    const { t, phone, phoneId, browser, browserId } = await setup();
    // The phone keeps one row across sign-ins (useEnsureDevice).
    await t.run((ctx) => ctx.db.delete(phone.sessionId));
    const devices = await browser.as.query(api.devices.list, {});
    expect(devices.map((d) => d._id)).toEqual([browserId, phoneId]);
  });

  it("alerts the other devices about a new one, not about the first", async () => {
    const { t, phone, browser, browserId } = await setup();
    const alerts = await phone.as.query(api.devices.pendingAlerts, {});
    expect(alerts.map((d) => d._id)).toEqual([browserId]);
    // The new device itself is not asked about itself.
    expect(await browser.as.query(api.devices.pendingAlerts, {})).toEqual([]);
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(scheduled.map((f) => f.name)).toEqual(["dispatch:notifyNewDevice"]);
  });

  it("'It was me' dismisses the alert", async () => {
    const { phone, browserId } = await setup();
    await phone.as.mutation(api.devices.confirm, {
      deviceId: browserId,
      _audit: await signedAudit(),
    });
    expect(await phone.as.query(api.devices.pendingAlerts, {})).toEqual([]);
  });

  it("revoking a device ends its session and deletes its passkeys", async () => {
    const { t, userId, phone, browser, browserId } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("passkey_credentials", {
        userId,
        credentialId: "browser-passkey",
        publicKey: "pk",
        counter: 0,
        deviceName: "Chrome",
        keeplasDeviceId: browserId,
        createdAt: 0,
        lastUsedAt: 0,
      }),
    );
    await phone.as.mutation(api.devices.revoke, {
      deviceId: browserId,
      _audit: await signedAudit(),
    });

    expect(await t.run((ctx) => ctx.db.get(browser.sessionId))).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("passkey_credentials").collect()),
    ).toEqual([]);
    // The browser's still-valid JWT is refused at once.
    await expect(register(browser.as, "web", "Chrome again")).rejects.toThrow(
      "Not authenticated",
    );
    expect(await browser.as.query(api.devices.list, {})).toEqual([]);
  });

  it("'It wasn't me' revokes, ends every other session and requires a rotation", async () => {
    const { t, userId, phone, browser, browserId } = await setup();
    const tablet = await signIn(t, userId);

    const result = await phone.as.mutation(api.devices.notMe, {
      deviceId: browserId,
      _audit: await signedAudit(),
    });

    expect(result).toEqual({
      deviceLabel: "Chrome on macOS",
      sessionsEnded: 2,
      recoveryCancelled: false,
    });
    expect(await t.run((ctx) => ctx.db.get(browser.sessionId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(tablet.sessionId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(phone.sessionId))).not.toBeNull();
    const browserRow = await t.run((ctx) => ctx.db.get(browserId));
    expect(browserRow?.revokedAt).toBeDefined();
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.masterKeyRotationRequired).toBe(true);
  });

  it("cannot remove the device in use", async () => {
    const { phone, phoneId } = await setup();
    await expect(
      phone.as.mutation(api.devices.notMe, {
        deviceId: phoneId,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("This is the device you are using");
  });

  it("alerts the other phones by push, never the new device itself", async () => {
    const { t, userId, phone, phoneId } = await setup();
    await phone.as.mutation(api.devices.setPushToken, {
      deviceId: phoneId,
      pushToken: "ExponentPushToken[phone]",
      _audit: await signedAudit(),
    });
    const tablet = await signIn(t, userId);
    await register(tablet.as, "android", "Pixel");
    const alerts = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    const last = alerts[alerts.length - 1];
    expect(last.args[0]).toMatchObject({
      deviceLabel: "Pixel",
      pushTokens: ["ExponentPushToken[phone]"],
    });
  });
});

describe("signing out and back in on the same phone", () => {
  const PUSH = "ExponentPushToken[phone]";

  async function signOutPhone(
    phone: { as: ReturnType<typeof asUserSession> },
    deviceId: Id<"devices">,
    reattachToken = "reattach-token",
  ) {
    await phone.as.mutation(api.devices.signOut, {
      deviceId: deviceId,
      reattachToken,
      _audit: await signedAudit(),
    });
  }

  async function setPush(
    as: ReturnType<typeof asUserSession>,
    deviceId: Id<"devices">,
  ) {
    await as.mutation(api.devices.setPushToken, {
      deviceId,
      pushToken: PUSH,
      _audit: await signedAudit(),
    });
  }

  async function alertsScheduled(t: TestConvex) {
    const jobs = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    return jobs.filter((job) => job.name === "dispatch:notifyNewDevice");
  }

  it("stops the signed-out account's alerts reaching this phone", async () => {
    const { t, userId, phone, phoneId } = await setup();
    await setPush(phone.as, phoneId);
    await signOutPhone(phone, phoneId);

    const row = await t.run((ctx) => ctx.db.get(phoneId));
    expect(row?.pushToken).toBeUndefined();
    expect(row?.revokedAt).toBeUndefined();
    const tablet = await signIn(t, userId);
    await register(tablet.as, "android", "Pixel");
    const alerts = await alertsScheduled(t);
    expect(alerts[alerts.length - 1].args[0].pushTokens).toEqual([]);
  });

  it("also clears the token from rows older sign-ins left behind", async () => {
    const { t, userId, phone, phoneId } = await setup();
    // Before phones kept one row, every sign-in registered a new one.
    const earlier = await signIn(t, userId);
    const earlierId = (await register(
      earlier.as,
      "ios",
      "iPhone 15",
    )) as Id<"devices">;
    await setPush(earlier.as, earlierId);
    await setPush(phone.as, phoneId);
    await signOutPhone(phone, phoneId);

    const rows = await t.run((ctx) => ctx.db.query("devices").collect());
    expect(rows.filter((d) => d.pushToken === PUSH)).toEqual([]);
  });

  it("only signs out the row of the calling session", async () => {
    const { browser, phoneId } = await setup();
    await expect(signOutPhone(browser, phoneId)).rejects.toThrow(
      "Not this device",
    );
  });

  it("takes its row back on the next sign-in, without a new-device alert", async () => {
    const { t, userId, phone, phoneId } = await setup();
    await signOutPhone(phone, phoneId, "secret-1");
    await t.run((ctx) => ctx.db.delete(phone.sessionId));
    const before = (await alertsScheduled(t)).length;

    const again = await signIn(t, userId);
    const deviceId = await again.as.mutation(api.devices.register, {
      kind: "ios",
      label: "iPhone 15",
      trusted: true,
      reattach: { deviceId: phoneId, token: "secret-1" },
      _audit: await signedAudit(),
    });

    expect(deviceId).toBe(phoneId);
    const rows = await t.run((ctx) => ctx.db.query("devices").collect());
    expect(rows).toHaveLength(2);
    const row = await t.run((ctx) => ctx.db.get(phoneId));
    expect(row?.sessionId).toBe(again.sessionId);
    expect((await alertsScheduled(t)).length).toBe(before);
    const alerts = await again.as.query(api.devices.pendingAlerts, {});
    expect(alerts.map((d) => d._id)).not.toContain(phoneId);
  });

  it("registers a new device, and alerts, for a wrong or reused token", async () => {
    const { t, userId, phone, phoneId } = await setup();
    await signOutPhone(phone, phoneId, "secret-1");
    const before = (await alertsScheduled(t)).length;

    const other = await signIn(t, userId);
    const reattach = async (token: string) =>
      other.as.mutation(api.devices.register, {
        kind: "ios",
        label: "iPhone 15",
        trusted: true,
        reattach: { deviceId: phoneId, token },
        _audit: await signedAudit(),
      });
    expect(await reattach("guessed")).not.toBe(phoneId);
    expect(await reattach("secret-1")).toBe(phoneId);
    expect(await reattach("secret-1")).not.toBe(phoneId);
    expect((await alertsScheduled(t)).length).toBe(before + 2);
  });

  it("never takes back a revoked row", async () => {
    const { t, userId, phone, phoneId, browser } = await setup();
    await signOutPhone(phone, phoneId, "secret-1");
    await browser.as.mutation(api.devices.revoke, {
      deviceId: phoneId,
      _audit: await signedAudit(),
    });

    const again = await signIn(t, userId);
    const deviceId = await again.as.mutation(api.devices.register, {
      kind: "ios",
      label: "iPhone 15",
      trusted: true,
      reattach: { deviceId: phoneId, token: "secret-1" },
      _audit: await signedAudit(),
    });
    expect(deviceId).not.toBe(phoneId);
  });

  it("pushes once per phone when older rows share its token", async () => {
    const { t, userId, phone, phoneId } = await setup();
    const earlier = await signIn(t, userId);
    const earlierId = (await register(
      earlier.as,
      "ios",
      "iPhone 15",
    )) as Id<"devices">;
    await setPush(earlier.as, earlierId);
    await setPush(phone.as, phoneId);
    const tablet = await signIn(t, userId);
    await register(tablet.as, "android", "Pixel");
    const alerts = await alertsScheduled(t);
    expect(alerts[alerts.length - 1].args[0].pushTokens).toEqual([PUSH]);
  });
});

describe("device location", () => {
  it("keeps the country attested by the audit context", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const { as } = await signIn(t, userId);
    const deviceId = (await register(
      as,
      "web",
      "Chrome on Mac",
    )) as Id<"devices">;
    const device = await t.run((ctx) => ctx.db.get(deviceId));
    expect(device?.country).toBe("FR");
  });

  it("keeps the city when the audit context signs it", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const { as } = await signIn(t, userId);
    const deviceId = (await as.mutation(api.devices.register, {
      kind: "ios",
      label: "iPhone",
      trusted: true,
      _audit: await signedAudit("Montréal"),
    })) as Id<"devices">;
    const device = await t.run((ctx) => ctx.db.get(deviceId));
    expect(device?.city).toBe("Montréal");
  });

  it("refuses a city that was changed after signing", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const { as } = await signIn(t, userId);
    const audit = await signedAudit("Montréal");
    await expect(
      as.mutation(api.devices.register, {
        kind: "ios",
        label: "iPhone",
        trusted: true,
        _audit: { ...audit, city: "Paris" },
      }),
    ).rejects.toThrow("Invalid audit context signature");
  });
});
