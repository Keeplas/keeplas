import { ContactKeyBlocked } from "@/crypto/contact-keys";
import { translate, type TranslateParams } from "@/i18n/translate";
import { contactKeyBlockedToast } from "../use-recipients";

const t = (key: string, params?: TranslateParams) =>
  translate("en", key, params);

describe("contactKeyBlockedToast", () => {
  it("names the contact Keeplas refused to encrypt for, with a way out the app has", () => {
    const message = contactKeyBlockedToast(
      new ContactKeyBlocked("c1", "fingerprint_changed", "Alex"),
      t,
    );
    expect(message?.title).toContain("Alex");
    expect(message?.description).toContain("Alex");
    // The app has no screen to check a contact's security code.
    expect(message?.description).not.toMatch(/security code|in People/);
  });

  it("leaves any other error to the caller", () => {
    expect(contactKeyBlockedToast(new Error("offline"), t)).toBeNull();
  });
});
