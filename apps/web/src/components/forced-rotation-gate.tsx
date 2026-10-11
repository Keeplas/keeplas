import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Button, Dialog, DialogContent, DialogTitle } from "@keeplas/ui";
import { StateMessage } from "@/components/state-message";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

/** "Finish securing your vault on your phone" (State Message). */
function SecureOnPhoneMessage({ onClose }: { onClose: () => void }) {
  const t = useTranslations("lifeCheck.return.onPhone");
  return (
    <StateMessage
      icon={ICON_PATHS.phone}
      tone="warning"
      title={t("title")}
      body={t("body")}
    >
      <Button variant="primary" size="cta" className="w-full" onClick={onClose}>
        {t("ok")}
      </Button>
    </StateMessage>
  );
}

/**
 * Owners flagged `masterKeyRotationRequired` (a pre-v2 Shamir split, or "It
 * wasn't me") must re-key the vault. Rotation needs the 24-word phrase, which
 * only the phone app asks for, so the web says to finish there. The notice
 * comes back on every load until the phone clears the flag.
 */
export function ForcedRotationGate() {
  const t = useTranslations("lifeCheck.return.onPhone");
  const viewer = useQuery(api.users.viewer);
  const [dismissed, setDismissed] = useState(false);

  if (!viewer?.masterKeyRotationRequired || dismissed) return null;

  return (
    <Dialog open onOpenChange={(open) => setDismissed(!open)}>
      <DialogContent
        overlayClassName="bg-scrim backdrop-blur-none"
        className="w-[456px] max-w-[calc(100%-32px)] rounded-lg border border-border-default bg-bg-surface p-0 shadow-card"
      >
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <SecureOnPhoneMessage onClose={() => setDismissed(true)} />
      </DialogContent>
    </Dialog>
  );
}
