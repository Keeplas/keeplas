import type { ExistingContact } from "expo-contacts/legacy";

import { fromDeviceContact } from "../device-contact";

function contact(fields: Partial<ExistingContact>): ExistingContact {
  return {
    id: "1",
    contactType: "person",
    name: "Marie Dupont",
    ...fields,
  } as ExistingContact;
}

describe("fromDeviceContact", () => {
  it("keeps the name, the first email and every phone number", () => {
    const picked = fromDeviceContact(
      contact({
        emails: [
          { label: "home", email: "marie.dupont@email.com" },
          { label: "work", email: "marie@work.com" },
        ],
        phoneNumbers: [
          { label: "mobile", number: "+33 6 12 34 56 78" },
          { label: "work", number: "+44 7400 123456" },
        ],
      }),
      "FR",
    );
    expect(picked).toEqual({
      name: "Marie Dupont",
      email: "marie.dupont@email.com",
      phones: [
        { label: "mobile", country: "FR", number: "6 12 34 56 78" },
        { label: "work", country: "GB", number: "7400 123456" },
      ],
    });
  });

  it("reads a number without a dial code in the contact's region", () => {
    const { phones } = fromDeviceContact(
      contact({
        phoneNumbers: [
          { label: "mobile", number: "07400 123456", countryCode: "gb" },
        ],
      }),
      "FR",
    );
    expect(phones).toEqual([
      { label: "mobile", country: "GB", number: "7400 123456" },
    ]);
  });

  it("falls back to the given region when the contact has none", () => {
    const { phones } = fromDeviceContact(
      contact({
        phoneNumbers: [{ label: "mobile", number: "06 12 34 56 78" }],
      }),
      "FR",
    );
    expect(phones).toEqual([
      { label: "mobile", country: "FR", number: "6 12 34 56 78" },
    ]);
  });

  it("keeps a number it cannot read as typed, so the user can fix it", () => {
    const { phones } = fromDeviceContact(
      contact({ phoneNumbers: [{ label: "home", number: " 12 " }] }),
      "FR",
    );
    expect(phones).toEqual([{ label: "home", country: "FR", number: "12" }]);
  });

  it("returns empty details for a contact with only a name", () => {
    expect(fromDeviceContact(contact({}), "FR")).toEqual({
      name: "Marie Dupont",
      email: "",
      phones: [],
    });
  });
});
