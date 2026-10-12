import { describe, expect, it } from "vitest";
import { openCloudBackup, sealCloudBackup } from "../src/cloud";

describe("cloud backup", () => {
  it("restores the RootKey with the CBK and the envelope", async () => {
    const rootKey = crypto.getRandomValues(new Uint8Array(32));
    const { cbk, envelope } = await sealCloudBackup({ rootKey, userId: "u1" });
    expect(await openCloudBackup({ envelope, cbk, userId: "u1" })).toEqual(
      rootKey,
    );
  });

  it("needs both halves and the right account", async () => {
    const rootKey = crypto.getRandomValues(new Uint8Array(32));
    const a = await sealCloudBackup({ rootKey, userId: "u1" });
    const b = await sealCloudBackup({ rootKey, userId: "u1" });
    await expect(
      openCloudBackup({ envelope: a.envelope, cbk: b.cbk, userId: "u1" }),
    ).rejects.toThrow();
    await expect(
      openCloudBackup({ envelope: a.envelope, cbk: a.cbk, userId: "u2" }),
    ).rejects.toThrow();
  });
});
