import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { StateMessage } from "@/components/state-message";
import { useI18n } from "@/providers/i18n-provider";

/** People and sharing (M06) arrive in the next part. */
export default function People() {
  const { t } = useI18n();
  return (
    <Screen header={<AppHeader />}>
      <StateMessage
        icon="people"
        tone="info"
        title={t("nav.people")}
        body={t("contacts.later")}
      />
    </Screen>
  );
}
