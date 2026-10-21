import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { Callout, ListRow } from "@/components/surfaces";
import { StateMessage } from "@/components/state-message";
import { Text } from "@/components/text";
import {
  useVaultData,
  type VaultItemSummary,
} from "@/features/vault/vault-data";
import { itemVisual } from "@/features/vault/item-visual";
import { formatBytes, formatDate } from "@/lib/format";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

type Archived = VaultItemSummary & { archivedAt: number };

export default function Archives() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { summarize } = useVaultData();
  const raw = useQuery(api.vault_items.getArchivedItems);
  const usage = useQuery(api.vaults.getUsageStats);
  const unarchive = useAuditedMutation(api.vault_items.unarchiveItem);
  const [items, setItems] = useState<Archived[]>();
  const [chosen, setChosen] = useState<Archived | null>(null);

  useEffect(() => {
    if (!raw) return;
    let alive = true;
    void Promise.all(
      raw.map(async (item) => ({
        ...(await summarize(item)),
        archivedAt: item.archivedAt ?? item.updatedAt,
      })),
    ).then((next) => alive && setItems(next));
    return () => {
      alive = false;
    };
  }, [raw, summarize]);

  function open(id: Id<"vault_items">) {
    setChosen(null);
    router.push({ pathname: "/item/[id]", params: { id } });
  }

  function restore(item: Archived) {
    setChosen(null);
    void unarchive({ itemId: item.id }).catch(() =>
      Alert.alert(t("archives.restoreFailed")),
    );
  }

  const header = <NavBar title={t("archives.title")} onBack={router.back} />;

  if (items?.length === 0) {
    return (
      <Screen header={header} center>
        <StateMessage
          icon="inbox"
          tone="info"
          title={t("archives.emptyTitle")}
          body={t("archives.emptyBody")}
        />
      </Screen>
    );
  }

  return (
    <Screen header={header} gap={12}>
      <Text variant="h1">{t("archives.title")}</Text>
      <Callout icon="inbox" text={t("archives.body")} />
      {usage?.archiveBytes ? (
        <Text variant="body-sm" color="text.muted">
          {t("archives.space", {
            size: formatBytes(usage.archiveBytes, language),
          })}
        </Text>
      ) : null}
      {(items ?? []).map((item) => (
        <ListRow
          key={item.id}
          icon={itemVisual(item).icon}
          title={item.title ?? t("capture.untitled")}
          description={t("archives.archivedOn", {
            date: formatDate(item.archivedAt, language),
          })}
          onPress={() => setChosen(item)}
        />
      ))}

      <BottomSheet
        visible={chosen !== null}
        onDismiss={() => setChosen(null)}
        title={chosen?.title ?? t("capture.untitled")}
      >
        {chosen ? (
          <>
            <ListRow
              icon="eye"
              title={t("itemActions.open")}
              onPress={() => open(chosen.id)}
            />
            <ListRow
              icon="rotate"
              title={t("archives.restore")}
              description={t("archives.restoreBody")}
              onPress={() => restore(chosen)}
            />
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
