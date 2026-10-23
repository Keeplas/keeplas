import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { Button, HelpHint, Icon, toast, useConfirm } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { Link, useRouter } from "@/lib/navigation";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useDecryptedTitles } from "@/lib/use-decrypted-titles";
import { Panel } from "@/components/v2/surface";

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
 * Written in the note editor (`/vault/new?welcome=1`: same crypto / upload /
 * recipient pipeline as regular vault items). Stored as vault_items with
 * isReleaseIntroduction=true so they're naturally swept into the release
 * fan-out, but hidden from the regular /vault listing.
 */
export function ReleaseIntroductionEditor() {
  const t = useTranslations("lifeCheck");
  const router = useRouter();
  const intros = useQuery(api.vault_items.listReleaseIntroductions);
  const titles = useDecryptedTitles(intros);
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const groups = useQuery(api.recipient_groups.listGroups);
  const archiveItem = useAuditedMutation(api.vault_items.archiveItem);
  const confirm = useConfirm();

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
      await archiveItem({ itemId: id });
    } catch (err) {
      toast({
        variant: "error",
        title: getErrorMessage(err, t("welcome.deleteError")),
      });
    }
  }

  const rows = (intros ?? []) as IntroductionRow[];

  return (
    <Panel
      id="welcome-message"
      className="flex scroll-mt-24 flex-col gap-[16px] p-[20px]"
    >
      <div className="flex items-start justify-between gap-[16px]">
        <div className="flex flex-col gap-[4px]">
          <h2 className="flex items-center gap-[8px] text-h3 text-text-primary">
            {t("welcome.title")}
            <HelpHint content={t("welcome.help")} />
          </h2>
          <p className="text-body-sm text-text-muted">
            {t("welcome.description")}
          </p>
        </div>
        <Button
          variant="bordered"
          size="regular"
          onClick={() => router.push("/vault/new?welcome=1")}
          className="shrink-0"
        >
          <Icon path={ICON_PATHS.plus} className="size-[16px]" />
          {t("welcome.newMessage")}
        </Button>
      </div>

      {intros === undefined ? (
        <p className="text-body-sm text-text-muted">{t("welcome.loading")}</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-[8px] rounded-md border border-dashed border-border-strong p-[24px] text-center">
          <Icon
            path={ICON_PATHS.mail}
            className="size-[28px] text-icon-subtle"
          />
          <p className="text-body-sm text-text-muted">{t("welcome.empty")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-[8px]">
          {rows.map((row) => (
            <li
              key={row._id}
              className="flex items-stretch justify-between gap-[8px] rounded-sm border border-border-default"
            >
              <Link
                href={`/vault/${row._id}`}
                aria-label={t("welcome.openAria", {
                  title: titles[row._id] ?? "",
                })}
                className="flex min-w-0 flex-1 flex-col gap-[2px] rounded-sm p-[14px] transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <span className="truncate text-label text-text-primary">
                  {titles[row._id] ?? ""}
                </span>
                <span className="text-body-sm text-text-muted">
                  {row.hasAttachments
                    ? t("welcome.kindWithRecording")
                    : t("welcome.kindText")}{" "}
                  {t("welcome.targetingPrefix", {
                    targeting: describeTargeting(row),
                  })}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(row._id, titles[row._id] ?? "")}
                aria-label={t("welcome.deleteAria", {
                  title: titles[row._id] ?? "",
                })}
                className="m-[8px] shrink-0 cursor-pointer self-start rounded-sm p-[8px] text-icon-subtle transition-colors hover:bg-bg-danger hover:text-action-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <Icon path={ICON_PATHS.trash} className="size-[16px]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
