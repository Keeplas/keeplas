import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useTranslations } from "@/lib/i18n";
import { RotateVaultDialog } from "./rotate-vault-dialog";

/**
 * Forces a master-key rotation for owners flagged `masterKeyRotationRequired`
 * (their MasterKey was once Shamir-split to trusted contacts, so old shards
 * may still sit on a contact's device). The dialog cannot be dismissed until
 * an attempt fails, and it comes back on the next load until the rotation
 * finishes (`finalizeRotation` clears the flag).
 */
export function ForcedRotationGate() {
  const t = useTranslations("lifeCheck");
  const viewer = useQuery(api.users.viewer);
  const [dismissed, setDismissed] = useState(false);

  if (!viewer?.masterKeyRotationRequired) return null;

  return (
    <RotateVaultDialog
      open={!dismissed}
      onOpenChange={(open) => setDismissed(!open)}
      description={t("return.forced.dialogDescription")}
      submitLabel={t("return.forced.submit")}
      successDescription={t("return.forced.successDescription")}
      dismissable={false}
    />
  );
}
