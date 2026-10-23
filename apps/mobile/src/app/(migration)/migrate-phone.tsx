import { PhoneNumberStep } from "@/features/phone-change";
import { useI18n } from "@/providers/i18n-provider";

/** M09-7 step 1: the phone number that will sign this account in. */
export default function MigratePhone() {
  const { t } = useI18n();
  return (
    <PhoneNumberStep
      title={t("migration.phoneStep")}
      verifyPath="/migrate-verify"
    />
  );
}
