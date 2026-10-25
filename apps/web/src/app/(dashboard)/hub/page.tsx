import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { listCounts } from "@keeplas/backend/lib/vault_groups";
import { Loader } from "@keeplas/ui";
import { ReturnAfterReleaseBanner } from "@/components/return-after-release-banner";
import { useVaultCapture } from "@/components/vault/use-vault-capture";
import { useItemLabels } from "@/lib/use-item-labels";
import { useVaultData } from "@/lib/vault-data";
import { HubView } from "./hub-view";

const RECENT_LIMIT = 5;

export default function HubPage() {
  const viewer = useQuery(api.users.viewer);
  const health = useQuery(api.recovery.getHealth);
  const backup = useQuery(api.cloud_backup.status);
  const contactsReady = useQuery(api.trusted_contacts.getContactsReady);
  const { items } = useVaultData();
  const labels = useItemLabels();
  const capture = useVaultCapture();

  const counts = useMemo(() => listCounts(items ?? []), [items]);

  if (!viewer || health === undefined || backup === undefined) {
    return <Loader />;
  }

  // Same ways back in as the mobile Home: one is enough.
  const recoveryCovered =
    !!backup?.enabled || !!contactsReady || !!health?.recoveryKit;

  return (
    <>
      <HubView
        firstName={viewer.name?.split(" ")[0] ?? ""}
        recoveryCovered={recoveryCovered}
        plan={viewer.plan ?? "free"}
        counts={{
          inbox: counts.inbox,
          documents: counts.documents,
          accounts: counts.accounts,
        }}
        recentItems={(items ?? []).slice(0, RECENT_LIMIT).map((item) => ({
          id: item.id,
          title: labels.title(item),
          type: labels.category(item),
          updatedAt: item.updatedAt,
        }))}
        onAdd={capture.add}
        onScan={capture.scan}
        notice={<ReturnAfterReleaseBanner />}
      />
      {capture.dialogs}
    </>
  );
}
