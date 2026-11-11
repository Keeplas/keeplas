import {
  contactsCanRecover,
  needsSocialRecoverySetup,
  targetKeyMaterial,
} from "../social-recovery-policy";

const health = (
  configured: boolean,
  renewalRequired = false,
  upgradeRequired = false,
) => ({
  trustContacts: {
    configured,
    renewalRequired,
    upgradeRequired,
    contactCount: configured ? 1 : 0,
    eligibleCount: 1,
  },
  recoveryKit: false,
  activeDevices: 1,
});

const contact = (id: string) => ({
  contactId: id as never,
  contactUserId: undefined,
  name: id,
  publicKey: "pk",
  identityPublicKey: undefined,
  publicKeySignature: undefined,
  pinnedIdentityFingerprint: undefined,
  pinnedIdentityMac: undefined,
  hasWraps: false,
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

  it("is false when a contact accepted but nothing was sealed", () => {
    expect(contactsCanRecover(health(false))).toBe(false);
  });

  it("is false when the sealed material needs a renewal", () => {
    expect(contactsCanRecover(health(true, true))).toBe(false);
  });

  it("is true once sealed and current", () => {
    expect(contactsCanRecover(health(true))).toBe(true);
  });

  it("is true for a legacy 2-approval seal still awaiting its upgrade", () => {
    expect(contactsCanRecover(health(true, false, true))).toBe(true);
  });
});

describe("needsSocialRecoverySetup", () => {
  it("waits for both queries", () => {
    expect(needsSocialRecoverySetup(undefined, targets(2))).toBe(false);
    expect(needsSocialRecoverySetup(health(false), undefined)).toBe(false);
  });

  it("never seals without a ready contact", () => {
    expect(needsSocialRecoverySetup(health(false), targets(0))).toBe(false);
  });

  it("seals when a single contact is ready and nothing was sealed", () => {
    expect(needsSocialRecoverySetup(health(false), targets(1))).toBe(true);
  });

  it("re-seals a legacy 2-approval generation so one contact is enough", () => {
    expect(
      needsSocialRecoverySetup(health(true, false, true), targets(2)),
    ).toBe(true);
  });

  it("renews when the contacts changed or a rotation happened", () => {
    expect(needsSocialRecoverySetup(health(true, true), targets(3))).toBe(true);
  });

  it("leaves current material alone", () => {
    expect(needsSocialRecoverySetup(health(true), targets(2))).toBe(false);
  });
});

describe("targetKeyMaterial", () => {
  it("hands the verifier the target's keys under the names it reads", () => {
    expect(
      targetKeyMaterial({
        contactId: "c1" as never,
        contactUserId: "u1" as never,
        name: "Ada",
        publicKey: "kem",
        identityPublicKey: "id",
        publicKeySignature: "sig",
        pinnedIdentityFingerprint: "fp",
        pinnedIdentityMac: "mac",
        hasWraps: true,
      }),
    ).toEqual({
      contactId: "c1",
      contactUserId: "u1",
      name: "Ada",
      contactPublicKey: "kem",
      contactIdentityPublicKey: "id",
      contactPublicKeySignature: "sig",
      pinnedIdentityFingerprint: "fp",
      pinnedIdentityMac: "mac",
      hasWraps: true,
    });
  });
});
