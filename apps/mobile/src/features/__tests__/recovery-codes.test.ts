/**
 * @jest-environment node
 */
import {
  generateRecipientKeyPair,
  serializePublicKey,
  serializeSecretKey,
} from "@keeplas/crypto/kem";
import { newRecoveryNonce, recoveryCommitment } from "@keeplas/crypto/social";

import {
  createRecoveryKey,
  loadRecoveryKey,
  syncContactCode,
  syncDeviceCodes,
  type CodeStore,
  type OwnRequest,
  type RequestForMe,
} from "../recovery-codes";

jest.mock("expo-secure-store", () => ({}));

const USER = "owner1";
const REQUEST = "request1";
const CONTACT = "contact1";

function memoryStore(): CodeStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
  };
}

/** Keeplas as it relays the exchange for one contact (honest by default). */
function relay(devicePublicKey: string) {
  const slot: {
    commitment: string | null;
    contactNonce: string | null;
    deviceNonce: string | null;
  } = { commitment: null, contactNonce: null, deviceNonce: null };
  const own = (): OwnRequest => ({
    requestId: REQUEST,
    contacts: [
      {
        contactId: CONTACT,
        decision: null,
        commitment: slot.commitment,
        contactNonce: slot.contactNonce,
        revealed: slot.deviceNonce !== null,
      },
    ],
  });
  const forMe = (): RequestForMe => ({
    requestId: REQUEST,
    contactId: CONTACT,
    newDevicePublicKey: devicePublicKey,
    ...slot,
  });
  return { slot, own, forMe };
}

async function honestExchange() {
  const deviceStore = memoryStore();
  const contactStore = memoryStore();
  const publicKey = await createRecoveryKey(deviceStore, USER);
  const server = relay(publicKey);
  const device = () =>
    syncDeviceCodes({
      store: deviceStore,
      userId: USER,
      publicKey,
      request: server.own(),
      commit: async ([c]) => void (server.slot.commitment = c.commitment),
      reveal: async (_, nonce) => void (server.slot.deviceNonce = nonce),
    });
  const contact = () =>
    syncContactCode({
      store: contactStore,
      request: server.forMe(),
      answer: async (nonce) => void (server.slot.contactNonce = nonce),
    });
  return { deviceStore, contactStore, publicKey, server, device, contact };
}

describe("recovery codes on the phones", () => {
  it("gives the device and the contact the same code", async () => {
    const { device, contact, publicKey } = await honestExchange();
    expect((await device())[CONTACT]).toEqual({ kind: "waiting" });
    expect(await contact()).toEqual({ kind: "waiting" });
    const onDevice = (await device())[CONTACT];
    expect(onDevice.kind).toBe("ready");
    const onContact = await contact();
    expect(onContact).toEqual({
      kind: "ready",
      code: (onDevice as { code: string }).code,
      devicePublicKey: publicKey,
    });
    // Stable across later updates.
    expect((await device())[CONTACT]).toEqual(onDevice);
  });

  it("shows no code to a contact when the device key was swapped", async () => {
    const { device, contact, server, contactStore } = await honestExchange();
    await device();
    await contact();
    await device();
    // Keeplas shows the contact another key next to the device's reveal.
    const swapped = serializePublicKey(generateRecipientKeyPair().publicKey);
    const state = await syncContactCode({
      store: contactStore,
      request: { ...server.forMe(), newDevicePublicKey: swapped },
      answer: async () => undefined,
    });
    expect(state).toEqual({ kind: "mismatch" });
  });

  it("flags a commitment the device never made, and a changed contact nonce", async () => {
    const { device, contact, server, publicKey } = await honestExchange();
    await device();
    await contact();
    const real = server.slot.commitment;
    server.slot.commitment = await recoveryCommitment(
      publicKey,
      newRecoveryNonce(),
    );
    expect((await device())[CONTACT]).toEqual({ kind: "mismatch" });
    server.slot.commitment = real;
    await device(); // keeps the first contact nonce and reveals
    server.slot.contactNonce = newRecoveryNonce();
    expect((await device())[CONTACT]).toEqual({ kind: "mismatch" });
  });

  it("refuses a commitment replaced after the contact answered", async () => {
    const { device, contact, server, publicKey } = await honestExchange();
    await device();
    await contact();
    server.slot.commitment = await recoveryCommitment(
      publicKey,
      newRecoveryNonce(),
    );
    expect(await contact()).toEqual({ kind: "mismatch" });
  });

  it("never answers twice: an answer from elsewhere shows no code", async () => {
    const { device, contact, server } = await honestExchange();
    await device();
    await contact();
    const fresh = await syncContactCode({
      store: memoryStore(),
      request: server.forMe(),
      answer: async () => {
        throw new Error("must not answer again");
      },
    });
    expect(fresh).toEqual({ kind: "elsewhere" });
  });

  it("reads the device key from a secret stored by an older app (in-flight request)", async () => {
    const store = memoryStore();
    const pair = generateRecipientKeyPair();
    // What the previous app version kept: the secret key only.
    store.data.set(
      `keeplas.recovery-device.${USER}`,
      serializeSecretKey(pair.secretKey),
    );
    const key = await loadRecoveryKey(store, USER);
    expect(key?.publicKey).toBe(serializePublicKey(pair.publicKey));
    expect(key?.secretKey).toEqual(pair.secretKey);
    expect(await loadRecoveryKey(memoryStore(), USER)).toBeNull();
  });
});
