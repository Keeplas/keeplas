import { errorText } from "@/lib/errors";

const RULES: [needle: string, key: string][] = [
  ["too many", "tooMany"],
  ["invalid email", "invalidEmail"],
  ["email is already linked", "emailTaken"],
  ["phone number is already linked", "phoneTaken"],
  ["new email is the same", "sameEmail"],
  ["new phone number is the same", "samePhone"],
  ["valid phone number", "invalidPhone"],
  ["proof", "proof"],
  ["identity key", "proof"],
  ["avatar_too_large", "imageTooLarge"],
  ["(413)", "imageTooLarge"],
  ["upload failed", "uploadFailed"],
  ["could not be resolved", "uploadFailed"],
  ["at least 18", "tooYoung"],
  ["implausibly old", "invalidBirthday"],
  // store_review.refuseOnReviewAccount
  ["review accounts can't change", "reviewAccount"],
];

export function accountErrorKey(
  error: unknown,
  fallback = "common.genericError",
): string {
  const text = errorText(error).toLowerCase();
  const rule = RULES.find(([needle]) => text.includes(needle));
  return rule ? `account.errors.${rule[1]}` : fallback;
}
