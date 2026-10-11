import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Loader, toast } from "@keeplas/ui";
import { AddItemDialog } from "@/components/add-item-dialog";
import { ReturnAfterReleaseBanner } from "@/components/return-after-release-banner";
import { useTranslations } from "@/lib/i18n";
import { useBackfillItemMeta } from "@/lib/use-backfill-item-meta";
import { useDecryptedTitles } from "@/lib/use-decrypted-titles";
import { useItemCategories } from "@/lib/use-item-categories";
import { CATEGORY_GROUP, type VaultCategory } from "@/lib/vault-categories";
import type { AddKind } from "./add-item-menu";
import { HubView } from "./hub-view";

const RECENT_LIMIT = 5;

// Where each "Add item" kind starts: documents and photos as documents, the
// rest in the Encrypted inbox ("other") to sort later, like mobile capture.
const KIND_CATEGORY: Record<AddKind, VaultCategory> = {
  document: "personal_document",
  photo: "personal_document",
  note: "other",
  voice: "other",
  video: "other",
};

// Required setup (BUSINESS-RULES): verified number, passkey, vault.
const SETUP_ACTIONS = ["verify_whatsapp", "two_factor"];

export default function HubPage() {
  const t = useTranslations("hub.add");
  const viewer = useQuery(api.users.viewer);
  const hub = useQuery(api.hub.getHubData);
  const health = useQuery(api.recovery.getHealth);
  const items = useQuery(api.vault_items.getItems);
  const vault = useQuery(api.vaults.getVault);
  const getOrCreateVault = useMutation(api.vaults.getOrCreateVault);
  const categories = useItemCategories(items);
  const titles = useDecryptedTitles(hub?.recentItems);
  const [adding, setAdding] = useState<VaultCategory | null>(null);
  useBackfillItemMeta();

  useEffect(() => {
    if (vault === null) void getOrCreateVault();
  }, [vault, getOrCreateVault]);

  const counts = useMemo(() => {
    const byGroup = { inbox: 0, documents: 0, accounts: 0 };
    for (const category of Object.values(categories)) {
      const group = CATEGORY_GROUP[category];
      if (group === "other") byGroup.inbox += 1;
      if (group === "document") byGroup.documents += 1;
      if (group === "account") byGroup.accounts += 1;
    }
    return byGroup;
  }, [categories]);

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
        counts={counts}
        recentItems={hub.recentItems.slice(0, RECENT_LIMIT).map((item) => ({
          id: item._id,
          title: titles[item._id] ?? "",
          group: CATEGORY_GROUP[categories[item._id] ?? "other"],
          updatedAt: item.updatedAt,
        }))}
        onAdd={(kind) => setAdding(KIND_CATEGORY[kind])}
        onScan={() =>
          toast({ title: t("scan.title"), description: t("scan.onPhone") })
        }
        notice={<ReturnAfterReleaseBanner />}
      />
      {vault ? (
        <AddItemDialog
          vaultId={vault._id}
          open={adding !== null}
          onOpenChange={(open) => !open && setAdding(null)}
          defaultCategory={adding ?? undefined}
        />
      ) : null}
    </>
  );
}
