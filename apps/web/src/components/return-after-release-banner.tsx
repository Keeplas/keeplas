import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Button, toast } from "@keeplas/ui";
import { IconTile, RowText } from "@/components/v2/surface";
import { useTranslations } from "@/lib/i18n";
import { ICON_PATHS } from "@/lib/icons";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { getErrorMessage } from "@/lib/utils";

/**
 * Shown to an owner who comes back AFTER an emergency release fired: revoke
 * the access granted to contacts here, then re-key the vault from the phone
 * app (rotation needs the 24 words, which the web never asks for).
 */
export function ReturnAfterReleaseBanner() {
  const t = useTranslations("lifeCheck.return");
  const requests = useQuery(api.access_requests.getAccessRequests);
  const viewer = useQuery(api.users.viewer);
  const revokeReleasedAccess = useAuditedMutation(
    api.access_requests.revokeReleasedAccess,
  );
  const [busy, setBusy] = useState(false);

  const released = (requests ?? []).some((r) => r.status === "approved");
  const rekeying =
    !!viewer?.masterKeyRotationRequired ||
    !!viewer?.encryptedAsymmetricSecretKeyPrev;

  if (!released && !rekeying) return null;

  async function revoke() {
    setBusy(true);
    try {
      await revokeReleasedAccess();
      toast({ title: t("revoked") });
    } catch (err) {
      toast({ variant: "error", title: getErrorMessage(err, t("failed")) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-[16px] rounded-[16px] bg-bg-danger p-[20px]">
      <div className="flex min-w-[240px] flex-1 items-center gap-[12px]">
        <IconTile
          icon={ICON_PATHS.shieldAlert}
          className="bg-bg-surface text-action-danger"
        />
        <RowText
          title={released ? t("releasedTitle") : t("onPhone.title")}
          description={released ? t("releasedBody") : t("onPhone.body")}
        />
      </div>
      {released ? (
        <Button
          variant="danger"
          size="compact"
          onClick={() => void revoke()}
          disabled={busy}
        >
          {t("revoke")}
        </Button>
      ) : null}
    </section>
  );
}
