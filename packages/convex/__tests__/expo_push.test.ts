import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { makeT, seedUser, type TestConvex } from "./test.helpers";

// Native push through the Expo push service: the payload must deep-link to a
// route the phone app has, and tokens Expo reports dead are dropped.

const EXPO_SEND = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS = "https://exp.host/--/api/v2/push/getReceipts";

type ExpoMessage = { to: string; data: { url: string }; priority?: string };
type Ticket = { status: "ok"; id: string } | ExpoError;
type ExpoError = { status: "error"; details: { error: string } };

const UNREGISTERED: ExpoError = {
  status: "error",
  details: { error: "DeviceNotRegistered" },
};

function mockExpo(
  tickets: (to: string) => Ticket,
  receipts: Record<string, ExpoError> = {},
) {
  const sent: ExpoMessage[] = [];
  const headers: Record<string, string>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === EXPO_SEND) {
        const messages = JSON.parse(init.body as string) as ExpoMessage[];
        sent.push(...messages);
        headers.push(init.headers as Record<string, string>);
        return Response.json({ data: messages.map((m) => tickets(m.to)) });
      }
      if (url === EXPO_RECEIPTS) return Response.json({ data: receipts });
      return Response.json({});
    }),
  );
  return { sent, headers };
}

async function seedPhone(
  t: TestConvex,
  userId: Id<"users">,
  pushToken: string,
): Promise<Id<"devices">> {
  return await t.run((ctx) =>
    ctx.db.insert("devices", {
      userId,
      kind: "ios",
      label: "iPhone",
      trusted: true,
      pushToken,
      lastSeenAt: Date.now(),
      createdAt: Date.now(),
    }),
  );
}

describe("Expo push", () => {
  beforeEach(() => {
    delete process.env.EXPO_ACCESS_TOKEN;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deep-links each alert to an existing phone route", async () => {
    const { sent } = mockExpo(() => ({ status: "ok", id: "r1" }));
    const t = makeT();
    const pushTokens = ["ExponentPushToken[a]"];
    await t.action(internal.dispatch.notifyNewDevice, {
      pushTokens,
      deviceLabel: "Chrome on macOS",
    });
    await t.action(internal.dispatch.notifyRecoveryStarted, { pushTokens });
    await t.action(internal.dispatch.notifyRecoveryContact, {
      pushTokens,
      ownerName: "Ada",
    });
    await t.action(internal.dispatch.notifyGraceCancel, { pushTokens });
    await t.action(internal.dispatch.notifyConfirmationRequest, {
      pushTokens,
      ownerName: "Ada",
    });
    await t.action(internal.dispatch.notifyRelease, {
      pushTokens,
      ownerName: "Ada",
    });
    expect(sent.map((m) => m.data)).toEqual([
      { url: "/devices" },
      { url: "/recovery" },
      { url: "/recovery" },
      { url: "/life-check" },
      { url: "/people" },
      { url: "/shared" },
    ]);
  });

  it("sends at high priority so Android delivers alerts in Doze", async () => {
    const { sent } = mockExpo(() => ({ status: "ok", id: "r1" }));
    await makeT().action(internal.dispatch.notifyNewDevice, {
      pushTokens: ["ExponentPushToken[a]"],
      deviceLabel: "Chrome on macOS",
    });
    expect(sent[0]?.priority).toBe("high");
  });

  it("authenticates with EXPO_ACCESS_TOKEN when set", async () => {
    process.env.EXPO_ACCESS_TOKEN = "expo-secret";
    const { headers } = mockExpo(() => ({ status: "ok", id: "r1" }));
    await makeT().action(internal.dispatch.notifyRecoveryStarted, {
      pushTokens: ["ExponentPushToken[a]"],
    });
    expect(headers[0]?.Authorization).toBe("Bearer expo-secret");
  });

  it("drops a token Expo rejects as unregistered", async () => {
    mockExpo((to) =>
      to === "ExponentPushToken[dead]"
        ? UNREGISTERED
        : { status: "ok", id: "r1" },
    );
    const t = makeT();
    const userId = await seedUser(t);
    const dead = await seedPhone(t, userId, "ExponentPushToken[dead]");
    const alive = await seedPhone(t, userId, "ExponentPushToken[alive]");
    await t.action(internal.dispatch.notifyRecoveryStarted, {
      pushTokens: ["ExponentPushToken[dead]", "ExponentPushToken[alive]"],
    });
    expect((await t.run((ctx) => ctx.db.get(dead)))?.pushToken).toBeUndefined();
    expect((await t.run((ctx) => ctx.db.get(alive)))?.pushToken).toBe(
      "ExponentPushToken[alive]",
    );
  });

  it("drops a token whose receipt reports it unregistered", async () => {
    mockExpo(() => ({ status: "ok", id: "r1" }), { r1: UNREGISTERED });
    const t = makeT();
    const userId = await seedUser(t);
    const phone = await seedPhone(t, userId, "ExponentPushToken[a]");
    await t.action(internal.dispatch.checkExpoPushReceipts, {
      tickets: [{ id: "r1", token: "ExponentPushToken[a]" }],
    });
    expect(
      (await t.run((ctx) => ctx.db.get(phone)))?.pushToken,
    ).toBeUndefined();
  });

  it("sends the Life Check push to the owner's phones", async () => {
    const { sent } = mockExpo(() => ({ status: "ok", id: "r1" }));
    const t = makeT();
    const userId = await seedUser(t);
    await seedPhone(t, userId, "ExponentPushToken[a]");
    const cycleId = await t.run(async (ctx) => {
      const configId = await ctx.db.insert("life_check_configs", {
        userId,
        frequency: "monthly",
        activeChannels: [],
        travelModeEnabled: false,
        isActive: true,
        nextCheckAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return await ctx.db.insert("life_check_cycles", {
        userId,
        configId,
        status: "running",
        channelsAttempted: [],
        scheduledAt: Date.now(),
        startedAt: Date.now(),
      });
    });
    await t.action(internal.dispatch.sendChannel, {
      cycleId,
      channelType: "push",
    });
    expect(sent).toMatchObject([
      { to: "ExponentPushToken[a]", data: { url: "/life-check" } },
    ]);
  });
});
