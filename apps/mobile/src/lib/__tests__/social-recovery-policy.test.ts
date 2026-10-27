import {
  contactsCanRecover,
  needsSocialRecoverySetup,
} from "../social-recovery-policy";

const health = (configured: boolean, renewalRequired = false) => ({
  trustContacts: {
    configured,
    renewalRequired,
    contactCount: configured ? 2 : 0,
    eligibleCount: 2,
  },
  recoveryKit: false,
  activeDevices: 1,
});

const contact = (id: string) => ({
  contactId: id as never,
  name: id,
  publicKey: "pk",
  identityPublicKey: undefined,
  publicKeySignature: undefined,
  pinnedIdentityFingerprint: undefined,
});

const targets = (n: number) => ({
  nextGeneration: 1,
  contacts: Array.from({ length: n }, (_, i) => contact(`c${i}`)),
});

describe("contactsCanRecover", () => {
  it("is false while loading or signed out", () => {
    expect(contactsCanRecover(undefined)).toBe(false);
    expect(contactsCanRecover(null)).toBe(false);
  });

  it("is false when 2 contacts accepted but nothing was sealed", () => {
    expect(contactsCanRecover(health(false))).toBe(false);
  });

  it("is false when the sealed material needs a renewal", () => {
    expect(contactsCanRecover(health(true, true))).toBe(false);
  });

  it("is true once sealed and current", () => {
    expect(contactsCanRecover(health(true))).toBe(true);
  });
});

describe("needsSocialRecoverySetup", () => {
  it("waits for both queries", () => {
    expect(needsSocialRecoverySetup(undefined, targets(2))).toBe(false);
    expect(needsSocialRecoverySetup(health(false), undefined)).toBe(false);
  });

  it("never seals with fewer than 2 ready contacts", () => {
    expect(needsSocialRecoverySetup(health(false), targets(1))).toBe(false);
  });

  it("seals when 2 contacts are ready and nothing was sealed", () => {
    expect(needsSocialRecoverySetup(health(false), targets(2))).toBe(true);
  });

  it("renews when the contacts changed or a rotation happened", () => {
    expect(needsSocialRecoverySetup(health(true, true), targets(3))).toBe(true);
  });

  it("leaves current material alone", () => {
    expect(needsSocialRecoverySetup(health(true), targets(2))).toBe(false);
  });
});
