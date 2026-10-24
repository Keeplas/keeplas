import type { ExistingContact } from "expo-contacts/legacy";

import { isCountryCode, toPhoneField, type CountryCode } from "@/lib/phone";

export interface ContactPhone {
  /** The address book's label, already localized ("mobile", "domicile"). */
  label: string;
  country: CountryCode;
  number: string;
}

/**
 * The details Add person prefills from a contact picked in the phone's
 * address book. Numbers without a dial code are read in the contact's
 * region, else in `country` (the Phone Input's current one).
 */
export function fromDeviceContact(
  contact: ExistingContact,
  country: CountryCode,
): { name: string; email: string; phones: ContactPhone[] } {
  return {
    // Typed as a string, but iOS omits it for a contact without a name.
    name: contact.name ?? "",
    email: contact.emails?.[0]?.email ?? "",
    phones: (contact.phoneNumbers ?? []).flatMap(
      ({ label, number, countryCode }) => {
        if (!number) return [];
        const region = countryCode?.toUpperCase();
        return [
          {
            label,
            ...toPhoneField(number, isCountryCode(region) ? region : country),
          },
        ];
      },
    ),
  };
}
