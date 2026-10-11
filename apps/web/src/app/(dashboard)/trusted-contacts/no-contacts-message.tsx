import { Button } from "@keeplas/ui";
import { StateMessage } from "@/components/state-message";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

/** Section 10 "No trusted contacts yet". */
export function NoContactsMessage({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations("trustedContacts.emptyState");
  return (
    <StateMessage
      icon={ICON_PATHS.userPlus}
      title={t("title")}
      body={t("description")}
    >
      <Button variant="primary" size="cta" className="w-full" onClick={onAdd}>
        {t("action")}
      </Button>
    </StateMessage>
  );
}
