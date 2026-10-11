import { useQuery } from "convex/react";
import { Loader } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { useTranslations } from "@/lib/i18n";
import { SharedVaultCard } from "./shared-vault-card";
import { useBackfillContactPublicKey } from "./use-backfill-contact-public-key";
import { useConfirmAvailability } from "./use-confirm-availability";

export function SharedVaultList() {
  const t = useTranslations("sharedWithMe");
  const vaults = useQuery(api.trusted_contacts.getVaultsWhereIAmContact);
  useBackfillContactPublicKey(vaults);
  useConfirmAvailability(vaults);

  if (vaults === undefined) {
    return <Loader size="md" />;
  }

  if (vaults.length === 0) {
    return (
      <div className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-12 rounded-sm">
        <h3 className="text-headline-sm text-primary">
          {t("list.empty.title")}
        </h3>
        <p className="text-body-md text-on-surface-variant mt-2 text-center max-w-md">
          {t("list.empty.description")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {vaults.map((vault) => (
        <SharedVaultCard key={vault._id} vault={vault} />
      ))}
    </div>
  );
}
