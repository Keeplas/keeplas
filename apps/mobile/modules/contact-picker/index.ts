// JS bridge to the KeeplasContactPicker native module (Android only). The
// system contacts app lets the user pick one phone number and grants Keeplas
// read access to that row alone, so the app needs no READ_CONTACTS
// permission. expo-contacts' Android picker reads the whole contact, which
// does need it. iOS uses expo-contacts: its picker needs no permission.
import { requireNativeModule } from "expo";

export interface PickedPhone {
  /** The contact's display name, when the contacts app has one. */
  name: string | null;
  /** The picked number in E.164 when the contacts app normalized it, else as typed. */
  number: string | null;
}

type NativeContactPicker = {
  pickPhone(): Promise<PickedPhone | null>;
};

const native = requireNativeModule<NativeContactPicker>("KeeplasContactPicker");

/** Opens the contacts app on its phone-number list. Null when the user backs out. */
export function pickPhone(): Promise<PickedPhone | null> {
  return native.pickPhone();
}
