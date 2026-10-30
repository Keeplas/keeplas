import { OtherOptions } from "@/features/other-options";
import { PhoneNumberStep } from "@/features/phone-change";
import { useI18n } from "@/providers/i18n-provider";

/**
 * Signed in with the 24 words after losing the number: set the new one.
 * The stage outlives a relaunch, so Sign out (in Other options) is the way
 * out; it also drops the pending new number.
 */
export default function NewNumber() {
  const { t } = useI18n();
  return (
    <PhoneNumberStep
      title={t("newNumber.title")}
      body={t("newNumber.body")}
      verifyPath="/new-number-verify"
      footer={<OtherOptions />}
    />
  );
}
