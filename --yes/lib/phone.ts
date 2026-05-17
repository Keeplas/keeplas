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
    throw new Error("Invalid phone number format");
  }
  return trimmed;
}
