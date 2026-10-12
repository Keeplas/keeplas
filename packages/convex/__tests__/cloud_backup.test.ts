import { describe, expect, it } from "vitest";
import { openCloudBackup, sealCloudBackup } from "@keeplas/crypto/cloud";
import { api } from "../_generated/api";
import { asUser, makeT, seedUser, signedAudit } from "./test.helpers";

// Phase 5 (D7): cloud backup of the RootKey. Toggle off deletes Keeplas's
// half (the app deletes the CBK from the platform keychain).

describe("cloud backup", () => {
  it("saves, restores on a new phone, and alerts the owner", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const as = asUser(t, userId);
    const rootKey = crypto.getRandomValues(new Uint8Array(32));
    const { cbk, envelope } = await sealCloudBackup({ rootKey, userId });
    await as.mutation(api.cloud_backup.save, {
      provider: "icloud",
      envelope,
      _audit: await signedAudit(),
    });
    expect(await as.query(api.cloud_backup.status, {})).toMatchObject({
      enabled: true,
      provider: "icloud",
    });

    const restored = await as.mutation(api.cloud_backup.restore, {
      _audit: await signedAudit(),
    });
    expect(
      await openCloudBackup({ envelope: restored.envelope, cbk, userId }),
    ).toEqual(rootKey);
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(scheduled.map((f) => f.name)).toContain("dispatch:notifyNewDevice");
  });

  it("turning it off deletes the envelope", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const as = asUser(t, userId);
    await as.mutation(api.cloud_backup.save, {
      provider: "google",
      envelope: "env",
      _audit: await signedAudit(),
    });
    await as.mutation(api.cloud_backup.disable, {
      _audit: await signedAudit(),
    });
    expect(await as.query(api.cloud_backup.status, {})).toEqual({
      enabled: false,
    });
    expect(
      await t.run((ctx) => ctx.db.query("cloud_backup_envelopes").collect()),
    ).toEqual([]);
    await expect(
      as.mutation(api.cloud_backup.restore, { _audit: await signedAudit() }),
    ).rejects.toThrow("No cloud backup");
  });

  it("rate-limits restores", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const as = asUser(t, userId);
    await as.mutation(api.cloud_backup.save, {
      provider: "google",
      envelope: "env",
      _audit: await signedAudit(),
    });
    for (let i = 0; i < 5; i++) {
      await as.mutation(api.cloud_backup.restore, {
        _audit: await signedAudit(),
      });
    }
    await expect(
      as.mutation(api.cloud_backup.restore, { _audit: await signedAudit() }),
    ).rejects.toThrow("Too many requests");
  });
});
