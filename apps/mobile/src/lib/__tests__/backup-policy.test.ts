import { needsCloudBackup } from "../backup-policy";

const saved = { provider: "icloud", createdAt: 1 } as const;

describe("needsCloudBackup", () => {
  it("waits while the status loads or when signed out", () => {
    expect(needsCloudBackup(undefined)).toBe(false);
    expect(needsCloudBackup(null)).toBe(false);
  });

  it("turns the backup on when it was never set up", () => {
    expect(needsCloudBackup({ enabled: false, turnedOff: false })).toBe(true);
  });

  it("never turns it back on after the owner turned it off", () => {
    expect(needsCloudBackup({ enabled: false, turnedOff: true })).toBe(false);
  });

  it("re-seals a backup made with older 24 words", () => {
    expect(needsCloudBackup({ enabled: true, current: false, ...saved })).toBe(
      true,
    );
  });

  it("leaves an up-to-date backup alone", () => {
    expect(needsCloudBackup({ enabled: true, current: true, ...saved })).toBe(
      false,
    );
  });
});
