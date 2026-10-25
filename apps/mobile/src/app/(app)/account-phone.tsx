import { PhoneNumberStep } from "@/features/phone-change";
import { useProveVault } from "@/features/vault-proof";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

export default function AccountPhone() {
  const { t } = useI18n();
  const viewer = useViewer();
  const { masterKey } = useVault();
  const proveVault = useProveVault();

  async function proveSession() {
    if (!viewer.phoneNumberVerifiedAt) return;
    if (!masterKey) throw new Error("Vault proof unavailable");
    await proveVault(masterKey);
  }

  return (
    <PhoneNumberStep
      title={t("account.phoneStep.title")}
      body={t("account.phoneStep.body")}
      verifyPath="/account-phone-verify"
      beforeRequest={proveSession}
    />
  );
}
