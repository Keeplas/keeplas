import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { StateMessage } from "@/components/state-message";
import { useI18n } from "@/providers/i18n-provider";

/** Search arrives with the vault list (capture part). */
export default function Search() {
  const { t } = useI18n();
  return (
    <Screen header={<AppHeader />}>
      <StateMessage
        icon="search"
        tone="info"
        title={t("nav.search")}
        body={t("common.comingSoon")}
      />
    </Screen>
  );
}
