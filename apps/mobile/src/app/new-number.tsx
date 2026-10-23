import { PhoneNumberStep } from "@/features/phone-change";
import { useI18n } from "@/providers/i18n-provider";

/** Signed in with the 24 words after losing the number: set the new one. */
export default function NewNumber() {
  const { t } = useI18n();
  return (
    <PhoneNumberStep
      title={t("newNumber.title")}
      body={t("newNumber.body")}
      verifyPath="/new-number-verify"
    />
  );
}
