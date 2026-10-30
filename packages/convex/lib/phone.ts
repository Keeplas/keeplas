import { ConvexError } from "convex/values";

/**
 * Server-side E.164 phone number sanity check. Defense-in-depth against
 * malformed values reaching the database when bypassing the client UI.
 *
 * We deliberately avoid pulling `libphonenumber-js` into the Convex bundle:
 * a regex-only validation is sufficient as a guardrail, and full parsing
 * already happens client-side in `@keeplas/ui` `PhoneInput`.
 */

const E164 = /^\+[1-9]\d{6,14}$/;

export function normalizeE164(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!E164.test(trimmed)) {
    throw new ConvexError("Invalid phone number format");
  }
  return trimmed;
}

/** Non-throwing E.164 check, for branching on a contact's channel. */
export function isE164(value: string): boolean {
  return E164.test(value.trim());
}

/**
 * The numbers of a comma-separated env list (DEV_TEST_PHONES, REVIEW_PHONES),
 * spaces removed so "+1 202 555 0101" matches the stored "+12025550101".
 */
export function listedPhones(list: string | undefined): string[] {
  return (list ?? "")
    .split(",")
    .map((entry) => entry.replace(/\s+/g, ""))
    .filter(Boolean);
}

/** Whether REVIEW_PHONES lists `phone`: an App Store / Play review account. */
export function isReviewPhone(phone: string | undefined): boolean {
  return !!phone && listedPhones(process.env.REVIEW_PHONES).includes(phone);
}

/** E.164 for display to its owner: country-ish prefix + last 2 digits. */
export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}•••${phone.slice(-2)}`;
}
