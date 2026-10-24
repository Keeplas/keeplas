import { ShellPage } from "@/components/shell/shell-page";
import { useTranslations } from "@/lib/i18n";
import { SharedVaultList } from "./shared-vault-list";

export default function SharedWithMePage() {
  const t = useTranslations("sharedWithMe");
  return (
    <ShellPage title={t("title")} subtitle={t("subtitle")}>
      <SharedVaultList />
    </ShellPage>
  );
}
