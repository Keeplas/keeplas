import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  buildCaptureQr,
  CAPTURE_QR_TTL_MS,
  parseCaptureQr,
} from "../lib/capture_qr";
import {
  asUser,
  makeT,
  seedUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

async function seedVault(t: TestConvex, userId: Id<"users">) {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("vaults", {
      userId,
      encryptedItemsCount: 0,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

async function createHandoff(t: TestConvex, userId: Id<"users">) {
  return await asUser(t, userId).mutation(api.capture_handoffs.create, {
    _audit: await signedAudit(),
  });
}

async function claim(t: TestConvex, userId: Id<"users">, handoffId: string) {
  return await asUser(t, userId).mutation(api.capture_handoffs.claim, {
    handoffId,
    _audit: await signedAudit(),
  });
}

async function createScan(
  t: TestConvex,
  userId: Id<"users">,
  captureHandoffId: Id<"capture_handoffs">,
) {
  const sealed = JSON.stringify({ ciphertext: "Y2lwaA==", iv: "aXY=" });
  return await asUser(t, userId).mutation(api.vault_items.createItem, {
    vaultId: await seedVault(t, userId),
    encryptedMeta: sealed,
    encryptedTitle: sealed,
    encryptedContent: sealed,
    accessLevel: "private",
    captureHandoffId,
    _audit: await signedAudit(),
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("capture handoffs (W06-7)", () => {
  it("links the browser's QR to the scan saved on the phone", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const { handoffId } = await createHandoff(t, owner);

    expect(
      await asUser(t, owner).query(api.capture_handoffs.get, { handoffId }),
    ).toMatchObject({ status: "waiting", itemId: null });

    await claim(t, owner, handoffId);
    const itemId = await createScan(t, owner, handoffId);

    expect(
      await asUser(t, owner).query(api.capture_handoffs.get, { handoffId }),
    ).toMatchObject({ status: "completed", itemId });
  });

  it("can't be claimed or read by another account", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const other = await seedUser(t);
    const { handoffId } = await createHandoff(t, owner);

    await expect(claim(t, other, handoffId)).rejects.toThrow(
      "CAPTURE_HANDOFF_INVALID",
    );
    expect(
      await asUser(t, other).query(api.capture_handoffs.get, { handoffId }),
    ).toBeNull();
  });

  it("refuses an expired QR, a used one and a malformed id", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const owner = await seedUser(t);
    const expired = await createHandoff(t, owner);
    vi.advanceTimersByTime(CAPTURE_QR_TTL_MS + 1);
    await expect(claim(t, owner, expired.handoffId)).rejects.toThrow(
      "CAPTURE_HANDOFF_EXPIRED",
    );

    const used = await createHandoff(t, owner);
    await claim(t, owner, used.handoffId);
    await expect(claim(t, owner, used.handoffId)).rejects.toThrow(
      "CAPTURE_HANDOFF_EXPIRED",
    );

    await expect(claim(t, owner, "not-an-id")).rejects.toThrow(
      "CAPTURE_HANDOFF_INVALID",
    );
  });

  it("replaces a waiting QR when the browser asks for a new one", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const first = await createHandoff(t, owner);
    await createHandoff(t, owner);

    expect(
      await asUser(t, owner).query(api.capture_handoffs.get, {
        handoffId: first.handoffId,
      }),
    ).toBeNull();
  });

  it("still saves a scan whose handoff is gone or not claimed", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    const { handoffId } = await createHandoff(t, owner);

    const itemId = await createScan(t, owner, handoffId);

    expect(itemId).toBeTruthy();
    expect(
      await asUser(t, owner).query(api.capture_handoffs.get, { handoffId }),
    ).toMatchObject({ status: "waiting", itemId: null });
  });

  it("round-trips the QR text", () => {
    const qr = buildCaptureQr("https://app.keeplas.com", "abc123");
    expect(qr).toBe("https://app.keeplas.com/capture#h=abc123");
    expect(parseCaptureQr(qr)).toEqual({
      handoffId: "abc123",
      origin: "https://app.keeplas.com",
    });
    expect(parseCaptureQr("https://app.keeplas.com/link#s=1&h=2")).toBeNull();
    expect(parseCaptureQr("not a url")).toBeNull();
  });
});
