import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import {
  asUser,
  makeT,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";
import type { Id } from "../_generated/dataModel";

// Finding 1: an identifier the user never proved owning (e.g. one an inviting
// owner typed, backfilled onto legacy accounts) must not receive Life Check
// check-ins, answer them, or get the 72h grace alert. Otherwise whoever holds
// that address keeps the user's dead-man's switch from ever firing.

type Sent = { url: string; to: unknown };

function captureFetch(): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      sent.push({ url, to: body.to ?? body.messages?.[0]?.to });
      return new Response(JSON.stringify({}));
    }),
  );
  return sent;
}

/** A user, their Life Check config and a running cycle. */
async function seedCycle(
  t: TestConvex,
  user: {
    email?: string;
    emailVerificationTime?: number;
    phoneNumber?: string;
    phoneNumberVerifiedAt?: number;
  },
  status: "running" | "awaiting_confirmation" = "running",
): Promise<{ userId: Id<"users">; cycleId: Id<"life_check_cycles"> }> {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", user);
    const configId = await ctx.db.insert("life_check_configs", {
      userId,
      frequency: "monthly",
      activeChannels: [],
      travelModeEnabled: false,
      isActive: true,
      nextCheckAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const cycleId = await ctx.db.insert("life_check_cycles", {
      userId,
      configId,
      status,
      channelsAttempted: [],
      pendingScheduleIds: [],
      scheduledAt: now,
      startedAt: now,
    });
    return { userId, cycleId };
  });
}

async function lastResponse(t: TestConvex, cycleId: Id<"life_check_cycles">) {
  const cycle = await t.run((ctx) => ctx.db.get(cycleId));
  return cycle?.channelsAttempted.at(-1)?.response;
}

describe("Life Check check-ins go to verified identifiers only", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "Keeplas <hello@keeplas.test>";
    process.env.APP_URL = "https://app.keeplas.test";
    process.env.INFOBIP_BASE_URL = "infobip.test";
    process.env.INFOBIP_API_KEY = "key";
    process.env.INFOBIP_WHATSAPP_SENDER = "33100000000";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips the email check-in when the email is unverified", async () => {
    const sent = captureFetch();
    const t = makeT();
    const { cycleId } = await seedCycle(t, { email: "planted@example.com" });

    await t.action(internal.dispatch.sendChannel, {
      cycleId,
      channelType: "email",
    });

    expect(sent).toEqual([]);
    expect(await lastResponse(t, cycleId)).toBe("email_unverified");
  });

  it("sends the email check-in to a verified email", async () => {
    const sent = captureFetch();
    const t = makeT();
    const { cycleId } = await seedCycle(t, {
      email: "owner@example.com",
      emailVerificationTime: Date.now(),
    });

    await t.action(internal.dispatch.sendChannel, {
      cycleId,
      channelType: "email",
    });

    expect(sent).toEqual([
      { url: "https://api.resend.com/emails", to: ["owner@example.com"] },
    ]);
  });

  it("skips the WhatsApp check-in when the phone is unverified", async () => {
    const sent = captureFetch();
    const t = makeT();
    const { cycleId } = await seedCycle(t, { phoneNumber: "+33611111111" });

    await t.action(internal.dispatch.sendChannel, {
      cycleId,
      channelType: "whatsapp",
    });

    expect(sent).toEqual([]);
    expect(await lastResponse(t, cycleId)).toBe("phone_unverified");
  });

  it("sends the WhatsApp check-in to a verified phone", async () => {
    const sent = captureFetch();
    const t = makeT();
    const { cycleId } = await seedCycle(t, {
      phoneNumber: "+33611111111",
      phoneNumberVerifiedAt: Date.now(),
    });

    await t.action(internal.dispatch.sendChannel, {
      cycleId,
      channelType: "whatsapp",
    });

    expect(sent.map((s) => s.to)).toEqual(["33611111111"]);
  });
});

describe("a WhatsApp reply proves liveness only from a verified phone", () => {
  it("ignores a reply from a phone the user never verified", async () => {
    const t = makeT();
    const { cycleId } = await seedCycle(t, { phoneNumber: "+33622222222" });

    const result = await t.mutation(internal.life_check.validateFromWhatsApp, {
      phoneNumber: "+33622222222",
    });

    expect(result.matched).toBe(false);
    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    expect(cycle?.status).toBe("running");
  });

  it("validates the verified owner even when an unverified row shares the phone", async () => {
    const t = makeT();
    // A legacy backfilled (unverified) copy of the number, inserted first.
    await seedCycle(t, { phoneNumber: "+33633333333" });
    const { cycleId } = await seedCycle(t, {
      phoneNumber: "+33633333333",
      phoneNumberVerifiedAt: Date.now(),
    });

    const result = await t.mutation(internal.life_check.validateFromWhatsApp, {
      phoneNumber: "+33633333333",
    });

    expect(result.matched).toBe(true);
    const cycle = await t.run((ctx) => ctx.db.get(cycleId));
    expect(cycle?.status).toBe("validated");
  });
});

describe("the 72h grace alert goes to verified identifiers only", () => {
  it("drops an unverified owner email from notifyGraceCancel", async () => {
    const t = makeT();
    const { userId: owner } = await seedCycle(
      t,
      {
        email: "planted@example.com",
        phoneNumber: "+33644444444",
        phoneNumberVerifiedAt: Date.now(),
      },
      "awaiting_confirmation",
    );
    await t.run(async (ctx) => {
      const config = await ctx.db
        .query("life_check_configs")
        .withIndex("by_user", (q) => q.eq("userId", owner))
        .first();
      await ctx.db.patch(config!._id, { confirmationThreshold: 1 });
    });
    const contactUser = await seedUser(t);
    const now = Date.now();
    const contactId = await t.run((ctx) =>
      ctx.db.insert("trusted_contacts", {
        userId: owner,
        contactUserId: contactUser,
        name: "Contact",
        email: "contact@example.com",
        role: "family",
        invitationStatus: "accepted",
        invitationToken: "tok-grace",
        invitedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await asUser(t, contactUser).mutation(
      api.access_requests.markUserUnreachable,
      { contactId, _audit: await signedAudit() },
    );

    const rows = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    const grace = rows.find((r) => r.name.includes("notifyGraceCancel"));
    expect(grace?.args[0]).toMatchObject({ phoneNumber: "+33644444444" });
    expect(grace?.args[0].email).toBeUndefined();
  });
});
