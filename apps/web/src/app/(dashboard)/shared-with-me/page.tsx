import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { formatPhone, toast, useConfirm } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { getErrorMessage } from "@/lib/utils";
import type { SharedVault } from "./shared-vault-card";
import { SharedVaultListView } from "./shared-vault-list";
import { useBackfillContactPublicKey } from "./use-backfill-contact-public-key";
import { useConfirmAvailability } from "./use-confirm-availability";

/** Vaults that name me as a contact (memorial release). */
export default function SharedWithMePage() {
  const t = useTranslations("sharedWithMe.card.unreachable");
  const vaults = useQuery(api.trusted_contacts.getVaultsWhereIAmContact);
  useBackfillContactPublicKey(vaults);
  useConfirmAvailability(vaults);
  const confirm = useConfirm();
  const markUnreachable = useAuditedMutation(
    api.access_requests.markUserUnreachable,
  );

  async function handleUnreachable(vault: SharedVault) {
    const ok = await confirm({
      title: t("confirmTitle", { name: formatPhone(vault.ownerName) }),
      description: t("confirmBody"),
      confirmLabel: t("confirm"),
    });
    if (!ok) return;
    try {
      await markUnreachable({ contactId: vault._id });
      toast({ title: t("done") });
    } catch (err) {
      toast({ variant: "error", title: getErrorMessage(err, t("error")) });
    }
  }

  return (
    <SharedVaultListView vaults={vaults} onUnreachable={handleUnreachable} />
  );
}
