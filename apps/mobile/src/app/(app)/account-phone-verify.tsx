import { useRouter } from "expo-router";

import { PhoneCodeStep } from "@/features/phone-change";
import { toast } from "@/lib/toast";
import { useI18n } from "@/providers/i18n-provider";

export default function AccountPhoneVerify() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <PhoneCodeStep
      onVerified={() => {
        toast({ variant: "success", title: t("account.phoneDone") });
        router.dismissTo("/account");
      }}
    />
  );
}
