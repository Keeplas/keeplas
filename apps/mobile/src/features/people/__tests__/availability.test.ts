import { dueForConfirmation, RECONFIRM_AFTER_MS } from "../availability";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 24);

type Vault = { id: string; lastVerifiedAt?: number };

describe("dueForConfirmation", () => {
  it("picks vaults never confirmed or confirmed over a week ago", () => {
    const never: Vault = { id: "a" };
    const stale: Vault = {
      id: "b",
      lastVerifiedAt: NOW - RECONFIRM_AFTER_MS - 1,
    };
    const fresh: Vault = { id: "c", lastVerifiedAt: NOW - RECONFIRM_AFTER_MS };

    expect(dueForConfirmation([never, stale, fresh], NOW)).toEqual([
      never,
      stale,
    ]);
  });

  it("keeps a contact who opens Keeplas every three weeks clear of the 30-day reminder", () => {
    const vault: Vault = { id: "a" };
    let longestGap = 0;
    for (let now = NOW; now < NOW + 365 * DAY; now += 21 * DAY) {
      if (dueForConfirmation([vault], now).length === 0) continue;
      if (vault.lastVerifiedAt !== undefined) {
        longestGap = Math.max(longestGap, now - vault.lastVerifiedAt);
      }
      vault.lastVerifiedAt = now;
    }

    expect(longestGap).toBeLessThanOrEqual(30 * DAY);
  });
});
