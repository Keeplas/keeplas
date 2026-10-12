import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useTranslations } from "@/lib/i18n";
import { SharedVaultCard } from "./shared-vault-card";
import { useBackfillContactPublicKey } from "./use-backfill-contact-public-key";
import { useConfirmAvailability } from "./use-confirm-availability";

/**
 * Vaults that name me as a contact (memorial release). Hidden when there are
 * none: the folders above carry the empty state.
 */
export function SharedVaultList() {
  const t = useTranslations("sharedWithMe");
  const vaults = useQuery(api.trusted_contacts.getVaultsWhereIAmContact);
  useBackfillContactPublicKey(vaults);
  useConfirmAvailability(vaults);

  if (!vaults || vaults.length === 0) return null;

  return (
    <section className="flex flex-col gap-[16px]">
      <h2 className="text-h3 text-text-primary">{t("list.title")}</h2>
      <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
        {vaults.map((vault) => (
          <SharedVaultCard key={vault._id} vault={vault} />
        ))}
      </div>
    </section>
  );
}
