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
});
