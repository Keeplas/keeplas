import { describe, it, expect } from "vitest";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
} from "@simplewebauthn/server";
import { REQUIRED_USER_VERIFICATION } from "../webauthn";

/**
 * Security regression guard (finding #6): the server passkey flow must demand
 * user verification (PIN / biometric / passcode), not possession alone. These
 * tests pin the shared option literal and prove the generated WebAuthn options
 * carry `userVerification: "required"` for BOTH registration and
 * authentication. They run the real @simplewebauthn/server option builders with
 * the exact value used in webauthn.ts, so a regression to "preferred" fails.
 */
describe("webauthn user verification hardening", () => {
  it("pins the shared user-verification policy to 'required'", () => {
    expect(REQUIRED_USER_VERIFICATION).toBe("required");
  });

  it("registration options require user verification", async () => {
    const options = await generateRegistrationOptions({
      rpName: "Keeplas Test",
      rpID: "localhost",
      userName: "curator@example.com",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: REQUIRED_USER_VERIFICATION,
      },
    });

    expect(options.authenticatorSelection?.userVerification).toBe("required");
  });

  it("authentication options require user verification", async () => {
    const options = await generateAuthenticationOptions({
      rpID: "localhost",
      userVerification: REQUIRED_USER_VERIFICATION,
    });

    expect(options.userVerification).toBe("required");
  });
});
