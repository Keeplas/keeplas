import { Button } from "@keeplas/ui";
import { StateMessage } from "@/components/state-message";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

/**
 * Section 10 "Camera / Microphone access is off". A web page cannot open the
 * browser's site settings, so the main action retries once access is allowed.
 */
export function PermissionOffMessage({
  device,
  onRetry,
  onDismiss,
}: {
  device: "camera" | "microphone";
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations(`chrome.permissionOff.${device}`);
  const common = useTranslations("chrome.permissionOff");
  return (
    <StateMessage
      icon={device === "camera" ? ICON_PATHS.camera : ICON_PATHS.mic}
      title={t("title")}
      body={t("body")}
    >
      <Button variant="primary" size="cta" className="w-full" onClick={onRetry}>
        {common("retry")}
      </Button>
      <Button
        variant="link"
        className="h-[24px] px-0 text-button"
        onClick={onDismiss}
      >
        {common("notNow")}
      </Button>
    </StateMessage>
  );
}
