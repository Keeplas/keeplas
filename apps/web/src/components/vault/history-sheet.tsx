import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  useConfirm,
} from "@keeplas/ui";
import { useLocale, useTranslations } from "@/lib/i18n";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useUploadQueue } from "@/lib/upload-queue";

/**
 * Edit history of an item ("See all" under Activity): every earlier
 * version, newest first, each restorable (the current one is kept as a
 * version too, so a restore can be undone).
 */
export function HistorySheet({
  open,
  onOpenChange,
  itemId,
  decrypt,
  canRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: Id<"vault_items">;
  /** Opens a payload sealed under the item key. */
  decrypt: (payload: string) => Promise<string>;
  /** False for archived items (restore them first). */
  canRestore: boolean;
}) {
  const t = useTranslations("vaultItem.history");
  const locale = useLocale();
  const confirm = useConfirm();
  const versions = useQuery(
    api.vault_items.getItemVersions,
    open ? { itemId } : "skip",
  );
  const restore = useAuditedMutation(api.vault_items.restoreItemVersion);
  const { showIfStorageFull } = useUploadQueue();
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!versions) return;
    let alive = true;
    Promise.all(
      versions.map(async (version) => [
        version._id,
        version.encryptedTitle
          ? await decrypt(version.encryptedTitle).catch(() => "")
          : "",
      ]),
    ).then((entries) => alive && setTitles(Object.fromEntries(entries)));
    return () => {
      alive = false;
    };
  }, [versions, decrypt]);

  const when = (timestamp: number) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(timestamp);

  async function restoreVersion(versionId: Id<"vault_item_versions">) {
    const ok = await confirm({
      title: t("confirmTitle"),
      description: t("confirmBody"),
      confirmLabel: t("restore"),
      cancelLabel: t("cancel"),
    });
    if (!ok) return;
    try {
      await restore({ itemId, versionId });
    } catch (error) {
      if (!(await showIfStorageFull(error))) throw error;
      return;
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        overlayClassName="bg-scrim backdrop-blur-none"
        className="flex w-full max-w-md flex-col gap-[16px] overflow-y-auto border-l border-border-default bg-bg-surface p-[24px]"
      >
        <SheetTitle className="text-h2 text-text-primary">
          {t("title")}
        </SheetTitle>
        <SheetDescription className="text-body-sm text-text-muted">
          {t("body")}
        </SheetDescription>
        {versions === undefined ? null : versions.length === 0 ? (
          <p className="text-body text-text-muted">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col">
            {versions.map((version) => (
              <li
                key={version._id}
                className="flex items-center gap-[12px] border-b border-border-default py-[12px]"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <span className="truncate text-label text-text-primary">
                    {titles[version._id] || t("untitled")}
                  </span>
                  <span className="text-body-sm text-text-muted">
                    {t("replaced", { date: when(version.replacedAt) })}
                  </span>
                </span>
                {canRestore ? (
                  <Button
                    variant="bordered"
                    size="compact"
                    onClick={() => void restoreVersion(version._id)}
                  >
                    {t("restore")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
