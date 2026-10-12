import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { infisicalKms } from "../recovery_node";

// Gate key G under Infisical KMS: machine-identity login, then encrypt/decrypt
// with the owner id sealed in the plaintext.

const SITE = "https://kms.test";
const TOKEN = "machine-token";

function fakeInfisical() {
  return vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    const json = (data: unknown) => new Response(JSON.stringify(data));
    if (url === `${SITE}/api/v1/auth/universal-auth/login`) {
      expect(body).toEqual({ clientId: "cid", clientSecret: "csecret" });
      return json({ accessToken: TOKEN });
    }
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
    if (url === `${SITE}/api/v1/kms/keys/key-1/encrypt`) {
      return json({ ciphertext: `sealed.${body.plaintext}` });
    }
    if (url === `${SITE}/api/v1/kms/keys/key-1/decrypt`) {
      return json({ plaintext: body.ciphertext.slice("sealed.".length) });
    }
    return new Response("not found", { status: 404 });
  });
}

describe("infisicalKms", () => {
  beforeEach(() => {
    process.env.INFISICAL_KMS_SITE_URL = SITE;
    process.env.INFISICAL_KMS_KEY_ID = "key-1";
    process.env.INFISICAL_KMS_CLIENT_ID = "cid";
    process.env.INFISICAL_KMS_CLIENT_SECRET = "csecret";
    vi.stubGlobal("fetch", fakeInfisical());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips G for its owner", async () => {
    const g = Buffer.alloc(32, 7);
    const ciphertext = await infisicalKms.encrypt(g, "user_a");
    expect(ciphertext.startsWith("infisical:v1:")).toBe(true);
    expect(await infisicalKms.decrypt(ciphertext, "user_a")).toEqual(g);
  });

  it("refuses to release G to another user", async () => {
    const ciphertext = await infisicalKms.encrypt(
      Buffer.alloc(32, 7),
      "user_a",
    );
    await expect(infisicalKms.decrypt(ciphertext, "user_b")).rejects.toThrow(
      "bound to another user",
    );
  });

  it("fails loudly when Infisical rejects the call", async () => {
    process.env.INFISICAL_KMS_KEY_ID = "unknown";
    await expect(
      infisicalKms.encrypt(Buffer.alloc(32, 7), "user_a"),
    ).rejects.toThrow("HTTP 404");
  });
});
