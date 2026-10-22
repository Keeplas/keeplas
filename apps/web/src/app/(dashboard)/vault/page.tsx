import { useMemo, useState } from "react";
import {
  isVaultListKey,
  listCounts,
  presetCategory,
  type VaultListKey,
} from "@keeplas/backend/lib/vault_groups";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { useConfirm } from "@keeplas/ui";
import { VaultEmptyMessage } from "@/app/(dashboard)/hub/hub-view";
import { useVaultCapture } from "@/components/vault/use-vault-capture";
import { formatRelative } from "@/lib/format";
import { useLocale, useTranslations } from "@/lib/i18n";
import { useRouter, useSearchParams } from "@/lib/navigation";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useItemLabels } from "@/lib/use-item-labels";
import { useVaultData } from "@/lib/vault-data";
import {
  filterItems,
  itemStyle,
  sortItems,
  type VaultSort,
} from "@/lib/vault-list";
import { VaultListView, type VaultListRow } from "./vault-list-view";

/** W06-1 My vault. The list comes from `?type=` (dashboard tiles link to it). */
export default function VaultPage() {
  const archiveTexts = useTranslations("vaultItem.archive");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("type") ?? "all";
  const list: VaultListKey = isVaultListKey(requested) ? requested : "all";
  const { items } = useVaultData();
  const labels = useItemLabels();
  const capture = useVaultCapture(presetCategory(list));
  const confirm = useConfirm();
  const archiveItem = useAuditedMutation(api.vault_items.archiveItem);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<VaultSort>("updated");

  const counts = useMemo(() => listCounts(items ?? []), [items]);

  const rows = useMemo<VaultListRow[] | undefined>(() => {
    if (!items) return undefined;
    return sortItems(filterItems(items, list, search), sort, locale).map(
      (item) => ({
        id: item.id,
        title: labels.title(item),
        detail: labels.detail(item),
        style: itemStyle(item),
        category: labels.category(item),
        folder: labels.folder(item),
        access: labels.access(item),
        updated: formatRelative(
          sort === "added" ? item.createdAt : item.updatedAt,
          locale,
        ),
      }),
    );
  }, [items, list, search, sort, locale, labels]);

  async function archive(id: string) {
    const ok = await confirm({
      title: archiveTexts("title"),
      description: archiveTexts("body"),
      confirmLabel: archiveTexts("confirm"),
      cancelLabel: archiveTexts("cancel"),
    });
    if (ok) await archiveItem({ itemId: id as Id<"vault_items"> });
  }

  return (
    <>
      <VaultListView
        list={list}
        counts={counts}
        rows={rows}
        search={search}
        sort={sort}
        onList={(next) =>
          router.replace(next === "all" ? "/vault" : `/vault?type=${next}`)
        }
        onSearch={setSearch}
        onSort={setSort}
        onArchive={(id) => void archive(id)}
        onFiles={capture.files}
        onAdd={capture.add}
        onScan={capture.scan}
        empty={<VaultEmptyMessage onAdd={() => capture.add("document")} />}
      />
      {capture.dialogs}
    </>
  );
}
