import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Loader } from "@keeplas/ui";
import { StateMessage } from "@/components/state-message";
import { Panel } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { SharedVaultCard } from "./shared-vault-card";
import { useBackfillContactPublicKey } from "./use-backfill-contact-public-key";
import { useConfirmAvailability } from "./use-confirm-availability";

/** Section 10 "Nothing shared with you yet". */
export function NothingSharedMessage() {
  const t = useTranslations("sharedWithMe.empty");
  return (
    <StateMessage icon={ICON_PATHS.inbox} title={t("title")} body={t("body")} />
  );
}

/** Vaults that name me as a contact (memorial release). */
export function SharedVaultList() {
  const t = useTranslations("sharedWithMe");
  const vaults = useQuery(api.trusted_contacts.getVaultsWhereIAmContact);
  useBackfillContactPublicKey(vaults);
  useConfirmAvailability(vaults);

  if (!vaults) return <Loader />;
  if (vaults.length === 0) {
    return (
      <Panel className="flex justify-center">
        <NothingSharedMessage />
      </Panel>
    );
  }

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
