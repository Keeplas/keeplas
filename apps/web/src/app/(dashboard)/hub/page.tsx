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

// Required setup (BUSINESS-RULES): verified number, passkey, vault.
const SETUP_ACTIONS = ["verify_whatsapp", "two_factor"];

export default function HubPage() {
  const viewer = useQuery(api.users.viewer);
  const hub = useQuery(api.hub.getHubData);
  const health = useQuery(api.recovery.getHealth);
  const { items } = useVaultData();
  const labels = useItemLabels();
  const capture = useVaultCapture();

  const counts = useMemo(() => listCounts(items ?? []), [items]);

  if (!viewer || !hub || health === undefined) return <Loader />;

  const setupDone =
    hub.priorityActions.filter(
      (action) => SETUP_ACTIONS.includes(action.key) && action.done,
    ).length + (hub.hasVault ? 1 : 0);

  return (
    <>
      <HubView
        firstName={viewer.name?.split(" ")[0] ?? ""}
        setupDone={setupDone}
        trustContactsReady={!!health?.trustContacts.configured}
        recoveryKitReady={!!health?.recoveryKit}
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
