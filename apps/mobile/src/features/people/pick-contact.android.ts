import { toPhoneField, type CountryCode } from "@/lib/phone";
import { pickPhone } from "../../../modules/contact-picker";
import type { PickedContact } from "./device-contact";

/**
 * Opens the contacts app on its phone-number list, without the READ_CONTACTS
 * permission. The user picks the number itself, so it gives one phone and no
 * email. A number without a dial code is read in `country`.
 */
export async function pickContact(
  country: CountryCode,
): Promise<PickedContact | null> {
  const picked = await pickPhone();
  if (!picked) return null;
  return {
    name: picked.name ?? "",
    email: "",
    phones: picked.number
      ? [{ label: "", ...toPhoneField(picked.number, country) }]
      : [],
  };
}
