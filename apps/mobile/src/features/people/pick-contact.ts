import { presentContactPickerAsync } from "expo-contacts/legacy";

import type { CountryCode } from "@/lib/phone";
import { fromDeviceContact, type PickedContact } from "./device-contact";

/**
 * Opens the iOS contact picker. It hands over the picked contact without any
 * contacts permission. Android: `pick-contact.android.ts`.
 */
export async function pickContact(
  country: CountryCode,
): Promise<PickedContact | null> {
  const contact = await presentContactPickerAsync();
  return contact ? fromDeviceContact(contact, country) : null;
}
