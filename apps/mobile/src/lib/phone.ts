import {
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
  type PhoneNumber,
} from "libphonenumber-js/mobile";
import examples from "libphonenumber-js/mobile/examples";

import { countryName } from "./format";

export type { CountryCode };

export interface Country {
  code: CountryCode;
  dialCode: string;
  name: string;
}

/** Regional-indicator emoji for an ISO 3166-1 alpha-2 code ("CA" → 🇨🇦). */
export function flagEmoji(code: CountryCode): string {
  return String.fromCodePoint(
    ...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/** Every dialable country, sorted by its name in `locale`. */
export function listCountries(locale: string): Country[] {
  return getCountries()
    .map((code) => ({
      code,
      dialCode: `+${getCountryCallingCode(code)}`,
      name: countryName(code, locale),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

export function isCountryCode(
  value: string | null | undefined,
): value is CountryCode {
  return !!value && (getCountries() as string[]).includes(value);
}

/**
 * A mobile example for the placeholder, without the national trunk prefix
 * ("0991 234 567" → "991 234 567") since it sits next to the dial code.
 */
export function examplePlaceholder(country: CountryCode): string {
  const example = getExampleNumber(country, examples);
  return example ? withoutDialCode(example) : "";
}

/**
 * A stored number split for the Phone Input ("+44 7400 123456" → GB and
 * "7400 123456"), read in `country` when it has no dial code. A number it
 * can't read stays as typed in `country`, so the field flags it.
 */
export function toPhoneField(
  raw: string,
  country: CountryCode,
): { country: CountryCode; number: string } {
  const parsed = parsePhoneNumberFromString(raw, country);
  return parsed?.country && parsed.isValid()
    ? { country: parsed.country, number: withoutDialCode(parsed) }
    : { country, number: raw.trim() };
}

function withoutDialCode(phone: PhoneNumber): string {
  return phone
    .formatInternational()
    .replace(`+${phone.countryCallingCode}`, "")
    .trim();
}

/** True once `input` has more digits than any number in `country` allows. */
export function isTooLong(country: CountryCode, input: string): boolean {
  return validatePhoneNumberLength(input, country) === "TOO_LONG";
}

/** E.164 for a valid mobile number typed in `country`, else null. */
export function toE164(country: CountryCode, input: string): string | null {
  const parsed = parsePhoneNumberFromString(input, country);
  return parsed?.isValid() ? parsed.number : null;
}

/** "+14165550123" → "+1 416 555 0123" for display. */
export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
