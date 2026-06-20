import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { Button, HelpHint, Icon, toast, useConfirm } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useDecryptedTitles } from "@/lib/use-decrypted-titles";
import { AddItemDialog } from "@/components/add-item-dialog";

type RecipientMode = "default" | "groups" | "explicit";

interface IntroductionRow {
  _id: Id<"vault_items">;
  recipientMode: RecipientMode;
  sharedWithContacts: Id<"trusted_contacts">[];
  sharedWithGroups: Id<"recipient_groups">[];
  createdAt: number;
  hasAttachments: boolean;
}

/**
 * Owner-facing editor for "release introductions" — short welcome messages
 * (text + optional audio/video) shown at the top of the memorial vault when
 * a trusted contact unlocks it after release.
 *
 * Reuses AddItemDialog in intro mode for authoring (same crypto / upload /
 * recipient pipeline as regular vault items). Stored as vault_items with
 * isReleaseIntroduction=true so they're naturally swept into the release
 * fan-out, but hidden from the regular /vault listing.
 */
export function ReleaseIntroductionEditor() {
  const t = useTranslations("lifeCheck");
  const vault = useQuery(api.vaults.getVault);
  const getOrCreateVault = useMutation(api.vaults.getOrCreateVault);
  const intros = useQuery(api.vault_items.listReleaseIntroductions);
  const titles = useDecryptedTitles(intros);
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const groups = useQuery(api.recipient_groups.listGroups);
  const deleteItem = useAuditedMutation(api.vault_items.deleteItem);
  const confirm = useConfirm();

  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (vault === null) {
      getOrCreateVault();
    }
  }, [vault, getOrCreateVault]);

  const contactNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contacts ?? []) m.set(c._id, c.name);
    return m;
  }, [contacts]);

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups ?? []) m.set(g._id, g.name);
    return m;
  }, [groups]);

  function describeTargeting(row: IntroductionRow): string {
    if (row.recipientMode === "default") return t("welcome.everyone");
    const names: string[] = [];
    for (const gid of row.sharedWithGroups) {
      const n = groupNameById.get(gid);
      if (n) names.push(n);
    }
    for (const cid of row.sharedWithContacts) {
      const n = contactNameById.get(cid);
      if (n) names.push(n);
    }
    if (names.length === 0) return t("welcome.noOneYet");
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }

  async function handleDelete(id: Id<"vault_items">, title: string) {
    const ok = await confirm({
      title: t("welcome.deleteTitle", { title }),
      description: t("welcome.deleteDescription"),
      confirmLabel: t("welcome.deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteItem({ itemId: id });
    } catch (err) {
      toast({
        variant: "error",
        title: getErrorMessage(err, t("welcome.deleteError")),
      });
    }
  }

  const rows = (intros ?? []) as IntroductionRow[];

  return (
    <section
      id="welcome-message"
      className="bg-surface-container-low rounded-2xl p-6 space-y-5 scroll-mt-24"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-headline-sm text-primary mb-1.5 flex items-center gap-2">
            {t("welcome.title")}
            <HelpHint content={t("welcome.help")} />
          </h3>
          <p className="text-body-md text-on-surface-variant">
            {t("welcome.description")}
          </p>
        </div>
        {vault && (
          <Button
            variant="default"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="gap-2 cursor-pointer shrink-0"
          >
            <Icon path={ICON_PATHS.plus} className="w-4 h-4" />
            {t("welcome.newMessage")}
          </Button>
        )}
      </div>

      {intros === undefined ? (
        <p className="text-body-md text-on-surface-variant/70">
          {t("welcome.loading")}
        </p>
      ) : rows.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-6 text-center">
          <Icon
            path={ICON_PATHS.mail}
            className="w-8 h-8 text-on-surface-variant/40 mx-auto mb-2"
          />
          <p className="text-body-md text-on-surface-variant">
            {t("welcome.empty")}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row._id}
              className="bg-surface p-4 rounded-xl flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-body-md font-bold text-primary truncate">
                  {titles[row._id] ?? ""}
                </p>
                <p className="text-label-md text-on-surface-variant mt-1">
                  {row.hasAttachments
                    ? t("welcome.kindWithRecording")
                    : t("welcome.kindText")}{" "}
                  {t("welcome.targetingPrefix", {
                    targeting: describeTargeting(row),
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(row._id, titles[row._id] ?? "")}
                aria-label={t("welcome.deleteAria", {
                  title: titles[row._id] ?? "",
                })}
                className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer shrink-0"
              >
                <Icon path={ICON_PATHS.trash} className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {vault && (
        <AddItemDialog
          vaultId={vault._id}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode="release_introduction"
        />
      )}
    </section>
  );
}
