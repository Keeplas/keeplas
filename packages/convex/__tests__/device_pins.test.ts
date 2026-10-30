import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { PIN_LOCKOUT_THRESHOLD, PIN_WIPE_THRESHOLD } from "../device_pins";
import { endSession } from "../lib/sessions";
import {
  asUserSession,
  makeT,
  seedSession,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// Server half of the web device PIN (findings 46 / 62): the browser's wrap
// needs a secret only Convex holds, released to the enrolling session after
// a correct PIN proof, with the attempt counter kept here.

const PROOF = Buffer.alloc(32, 1).toString("base64");
const WRONG = Buffer.alloc(32, 2).toString("base64");
const SECRET = Buffer.alloc(32, 3).toString("base64");

async function signIn(t: TestConvex, userId: Id<"users">) {
  const sessionId = await seedSession(t, userId);
  return { sessionId, as: asUserSession(t, userId, sessionId) };
}

type Session = Awaited<ReturnType<typeof signIn>>;

async function enroll(session: Session, pinProof = PROOF) {
  const { pinId } = await session.as.mutation(api.device_pins.enroll, {
    pinProof,
    secret: SECRET,
    _audit: await signedAudit(),
  });
  return pinId;
}

async function release(
  session: Session,
  pinId: Id<"device_pins">,
  pinProof = PROOF,
) {
  return session.as.mutation(api.device_pins.release, {
    pinId,
    pinProof,
    _audit: await signedAudit(),
  });
}

async function setup() {
  const t = makeT();
  const userId = await seedUser(t);
  const browser = await signIn(t, userId);
  const pinId = await enroll(browser);
  return { t, userId, browser, pinId };
}

/** Clear a lockout as if its minute had passed. */
async function waitOutLockout(t: TestConvex, pinId: Id<"device_pins">) {
  await t.run((ctx) => ctx.db.patch(pinId, { lockedUntil: Date.now() - 1 }));
}

describe("device_pins", () => {
  it("releases the secret to its session after a correct PIN proof", async () => {
    const { browser, pinId } = await setup();
    const result = await release(browser, pinId);
    expect(result).toMatchObject({ status: "ok", secret: SECRET });
  });

  it("stores a hash of the proof, never the proof itself", async () => {
    const { t, pinId } = await setup();
    const row = await t.run((ctx) => ctx.db.get(pinId));
    expect(row?.proofHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(PROOF);
  });

  it("counts wrong PINs server-side, locks, then deletes the row", async () => {
    const { t, browser, pinId } = await setup();
    for (let n = 1; n < PIN_LOCKOUT_THRESHOLD; n++) {
      expect(await release(browser, pinId, WRONG)).toMatchObject({
        status: "wrong",
        failCount: n,
        maxAttempts: PIN_WIPE_THRESHOLD,
      });
    }
    expect(await release(browser, pinId, WRONG)).toMatchObject({
      status: "locked",
    });
    // Locked: even the right PIN is refused until the minute is over.
    expect(await release(browser, pinId)).toMatchObject({ status: "locked" });

    for (let n = PIN_LOCKOUT_THRESHOLD + 1; n < PIN_WIPE_THRESHOLD; n++) {
      await waitOutLockout(t, pinId);
      expect(await release(browser, pinId, WRONG)).toMatchObject({
        status: "locked",
      });
    }
    await waitOutLockout(t, pinId);
    expect(await release(browser, pinId, WRONG)).toEqual({ status: "wiped" });
    expect(await t.run((ctx) => ctx.db.get(pinId))).toBeNull();
    // The secret is gone for good: the browser's wrap can no longer open.
    expect(await release(browser, pinId)).toEqual({ status: "gone" });
  });

  it("resets the counter after a correct PIN", async () => {
    const { t, browser, pinId } = await setup();
    await release(browser, pinId, WRONG);
    await release(browser, pinId, WRONG);
    await release(browser, pinId);
    const row = await t.run((ctx) => ctx.db.get(pinId));
    expect(row?.failCount).toBe(0);
  });

  it("never releases to another session of the same user", async () => {
    const { t, userId, pinId } = await setup();
    const other = await signIn(t, userId);
    expect(await release(other, pinId)).toEqual({ status: "gone" });
    const row = await t.run((ctx) => ctx.db.get(pinId));
    expect(row?.failCount).toBe(0);
  });

  it("never releases to another user", async () => {
    const { t, pinId } = await setup();
    const stranger = await signIn(t, await seedUser(t));
    expect(await release(stranger, pinId)).toEqual({ status: "gone" });
  });

  it("ends with its session (sign-out, revoked device, it wasn't me)", async () => {
    const { t, browser, pinId } = await setup();
    await t.run((ctx) => endSession(ctx, browser.sessionId));
    expect(await t.run((ctx) => ctx.db.get(pinId))).toBeNull();
  });

  it("tells whether this browser was linked as trusted", async () => {
    const { t, userId } = await setup();
    for (const trusted of [true, false]) {
      const browser = await signIn(t, userId);
      await browser.as.mutation(api.devices.register, {
        kind: "web",
        label: "Firefox on Linux",
        trusted,
        _audit: await signedAudit(),
      });
      const pinId = await enroll(browser);
      expect(await release(browser, pinId)).toMatchObject({
        status: "ok",
        trusted,
      });
    }
  });

  it("treats a browser with no device record as untrusted", async () => {
    const { browser, pinId } = await setup();
    expect(await release(browser, pinId)).toMatchObject({ trusted: false });
  });

  it("removes only the user's own PIN", async () => {
    const { t, browser, pinId } = await setup();
    const stranger = await signIn(t, await seedUser(t));
    await stranger.as.mutation(api.device_pins.remove, {
      pinId,
      _audit: await signedAudit(),
    });
    expect(await t.run((ctx) => ctx.db.get(pinId))).not.toBeNull();
    await browser.as.mutation(api.device_pins.remove, {
      pinId,
      _audit: await signedAudit(),
    });
    expect(await t.run((ctx) => ctx.db.get(pinId))).toBeNull();
  });

  it("rejects a proof or secret that is not 32 base64 bytes", async () => {
    const t = makeT();
    const browser = await signIn(t, await seedUser(t));
    await expect(enroll(browser, "1234")).rejects.toThrow();
    await expect(
      browser.as.mutation(api.device_pins.enroll, {
        pinProof: PROOF,
        secret: "short",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow();
  });

  it("drops the rows of ended sessions when a PIN is saved", async () => {
    const { t, userId, browser, pinId } = await setup();
    await t.run((ctx) => ctx.db.delete(browser.sessionId));
    await enroll(await signIn(t, userId));
    expect(await t.run((ctx) => ctx.db.get(pinId))).toBeNull();
  });
});
