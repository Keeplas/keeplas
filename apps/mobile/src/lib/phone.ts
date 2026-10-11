import {
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/mobile";
import examples from "libphonenumber-js/mobile/examples";

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

function countryName(code: CountryCode, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
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

/** A national mobile example for the placeholder ("416 555 0123"). */
export function examplePlaceholder(country: CountryCode): string {
  return getExampleNumber(country, examples)?.formatNational() ?? "";
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
