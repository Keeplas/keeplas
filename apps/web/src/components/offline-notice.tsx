import { useEffect, useState } from "react";
import { Button } from "@keeplas/ui";
import { StateDialog } from "@/components/state-dialog";
import { StateMessage } from "@/components/state-message";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

/** Section 10 "You're offline" (web: the app reconnects on its own). */
export function OfflineMessage({ onClose }: { onClose: () => void }) {
  const t = useTranslations("chrome.offline");
  return (
    <StateMessage
      icon={ICON_PATHS.cloudUpload}
      title={t("title")}
      body={t("body")}
    >
      <Button variant="primary" size="cta" className="w-full" onClick={onClose}>
        {t("ok")}
      </Button>
    </StateMessage>
  );
}

/** Opens once each time the browser goes offline. */
export function OfflineNotice() {
  const t = useTranslations("chrome.offline");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const offline = () => setOpen(true);
    const online = () => setOpen(false);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  return (
    <StateDialog open={open} onOpenChange={setOpen} title={t("title")}>
      <OfflineMessage onClose={() => setOpen(false)} />
    </StateDialog>
  );
}
