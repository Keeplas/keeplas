import { Button } from "@keeplas/ui";
import { StateMessage } from "@/components/state-message";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

const SECONDARY = "h-[24px] px-0 text-button";

/** Section 10 "Upload failed": retry, or drop the file from the queue. */
export function UploadFailedMessage({
  name,
  onRetry,
  onRemove,
}: {
  name: string;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("vault.upload.state.failed");
  return (
    <StateMessage
      icon={ICON_PATHS.cloudUpload}
      tone="danger"
      title={t("title")}
      body={t("body", { name })}
    >
      <Button variant="primary" size="cta" className="w-full" onClick={onRetry}>
        {t("retry")}
      </Button>
      <Button variant="link" className={SECONDARY} onClick={onRemove}>
        {t("remove")}
      </Button>
    </StateMessage>
  );
}

/** Section 10 "Your 100 MB are full": upgrade, or free up space. */
export function StorageFullMessage({
  quota,
  canUpgrade,
  onUpgrade,
  onManage,
}: {
  /** "100 MB" */
  quota: string;
  canUpgrade: boolean;
  onUpgrade: () => void;
  onManage: () => void;
}) {
  const t = useTranslations("vault.upload.state.full");
  return (
    <StateMessage
      icon={ICON_PATHS.folder}
      tone="warning"
      title={t("title", { quota })}
      body={canUpgrade ? t("bodyFree") : t("body")}
    >
      {canUpgrade ? (
        <Button
          variant="primary"
          size="cta"
          className="w-full"
          onClick={onUpgrade}
        >
          {t("upgrade")}
        </Button>
      ) : null}
      <Button
        variant={canUpgrade ? "link" : "primary"}
        size={canUpgrade ? undefined : "cta"}
        className={canUpgrade ? SECONDARY : "w-full"}
        onClick={onManage}
      >
        {t("manage")}
      </Button>
    </StateMessage>
  );
}
