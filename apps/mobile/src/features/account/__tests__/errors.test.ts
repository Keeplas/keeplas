import { ConvexError } from "convex/values";

import { translate } from "@/i18n/translate";
import { AvatarTooLarge } from "../avatar";
import { accountErrorKey } from "../errors";

jest.mock("../avatar", () => ({
  AvatarTooLarge: class extends Error {
    constructor() {
      super("AVATAR_TOO_LARGE");
    }
  },
}));

const CASES: [message: string, key: string][] = [
  ["Invalid email address", "account.errors.invalidEmail"],
  ["New email is the same as the current one.", "account.errors.sameEmail"],
  [
    "New phone number is the same as the current one.",
    "account.errors.samePhone",
  ],
  [
    "This email is already linked to another account.",
    "account.errors.emailTaken",
  ],
  [
    "This phone number is already linked to another account.",
    "account.errors.phoneTaken",
  ],
  [
    "Too many verification attempts. Try again later.",
    "account.errors.tooMany",
  ],
  ["A valid phone number is required", "account.errors.invalidPhone"],
  ["Vault proof refused", "account.errors.proof"],
  ["Identity key unavailable", "account.errors.proof"],
  ["Upload failed (500)", "account.errors.uploadFailed"],
  ["Upload failed (413)", "account.errors.imageTooLarge"],
  ["Uploaded image could not be resolved", "account.errors.uploadFailed"],
  [
    "You must be at least 18 years old to use Keeplas",
    "account.errors.tooYoung",
  ],
  ["Birthday is implausibly old", "account.errors.invalidBirthday"],
];

describe("accountErrorKey", () => {
  it.each(CASES)("maps %s", (message, key) => {
    expect(accountErrorKey(new Error(message))).toBe(key);
  });

  it("reads ConvexError data", () => {
    expect(accountErrorKey(new ConvexError("PHONE_PROOF_REQUIRED"))).toBe(
      "account.errors.proof",
    );
  });

  it("maps a too-large avatar", () => {
    expect(accountErrorKey(new AvatarTooLarge())).toBe(
      "account.errors.imageTooLarge",
    );
  });

  it("never surfaces an unknown server message", () => {
    expect(accountErrorKey(new Error("Server Error"))).toBe(
      "common.genericError",
    );
    expect(
      accountErrorKey(new Error("boom"), "account.errors.uploadFailed"),
    ).toBe("account.errors.uploadFailed");
  });

  it("only returns keys that have copy in both languages", () => {
    for (const [, key] of CASES) {
      expect(translate("en", key)).not.toBe(key);
      expect(translate("fr", key)).not.toBe(key);
    }
  });
});
