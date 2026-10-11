import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Button, Icon } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { ICON_PATHS } from "@/lib/icons";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { RotateVaultDialog } from "./rotate-vault-dialog";

/**
 * Shown to a vault owner who returns AFTER an emergency release fired. Lets
 * them revoke the granted access and rotate the master key so the leaked
 * material can no longer open anything they change going forward.
 */
export function ReturnAfterReleaseBanner() {
  const t = useTranslations("lifeCheck");
  const requests = useQuery(api.access_requests.getAccessRequests);
  const viewer = useQuery(api.users.viewer);
  const revokeReleasedAccess = useAuditedMutation(
    api.access_requests.revokeReleasedAccess,
  );
  const [open, setOpen] = useState(false);

  const hasApprovedRelease = (requests ?? []).some(
    (r) => r.status === "approved",
  );
  const rotationInProgress = !!viewer?.encryptedAsymmetricSecretKeyPrev;

  if (!hasApprovedRelease && !rotationInProgress) return null;

  return (
    <>
      <div className="mb-8 rounded-sm bg-error-container text-on-error-container p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon
            path={ICON_PATHS.shieldCheck}
            className="w-6 h-6 shrink-0 mt-1"
          />
          <div>
            <p className="text-title-md">
              {rotationInProgress
                ? t("return.bannerTitleResume")
                : t("return.bannerTitleReleased")}
            </p>
            <p className="text-body-md mt-1 max-w-xl">
              {rotationInProgress
                ? t("return.bannerBodyResume")
                : t("return.bannerBodyReleased")}
            </p>
          </div>
        </div>
        <Button
          variant="vault"
          className="shrink-0"
          onClick={() => setOpen(true)}
        >
          {rotationInProgress ? t("return.resumeCta") : t("return.secureCta")}
        </Button>
      </div>

      <RotateVaultDialog
        open={open}
        onOpenChange={setOpen}
        description={t("return.dialogDescription")}
        submitLabel={t("return.submit")}
        successDescription={t("return.successDescription")}
        // Cut the granted access first (idempotent), then re-key the vault.
        beforeRotate={revokeReleasedAccess}
        dismissable
      />
    </>
  );
}
