import { useState } from "react";
import { useParams } from "@/lib/navigation";
import { Link } from "@/lib/navigation";
import { useQuery } from "convex/react";
import { Loader, Icon } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { useTranslations } from "@/lib/i18n";
import { useCategoryLabel, useSortedCategories } from "@/lib/use-categories";
import { useDecryptedTitles } from "@/lib/use-decrypted-titles";
import { MemorialIntroductionCard } from "./memorial-introduction-card";
import { MemorialIntroductionDialog } from "./memorial-introduction-dialog";

function seenStorageKey(contactId: string) {
  return `keeplas:memorial-intros-seen:${contactId}`;
}

function readSeenIntros(contactId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(seenStorageKey(contactId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function markIntrosSeen(contactId: string, introIds: string[]) {
  if (typeof window === "undefined") return;
  try {
    const current = new Set(readSeenIntros(contactId));
    for (const id of introIds) current.add(id);
    window.localStorage.setItem(
      seenStorageKey(contactId),
      JSON.stringify(Array.from(current)),
    );
  } catch {
    // localStorage unavailable (private mode quota, disabled storage) — the
    // dialog just re-opens next visit, which is a benign degradation.
  }
}

export default function MemorialVaultPage() {
  const t = useTranslations("sharedWithMe");
  const categoryLabel = useCategoryLabel();
  const sortedCategories = useSortedCategories();
  const params = useParams();
  const contactId = params.contactId as Id<"trusted_contacts">;
  const data = useQuery(api.memorial.getReleasedVaultForMe, { contactId });
  // Recipient-side title decryption: each item carries its own wrappedDek.
  const titles = useDecryptedTitles(data?.items);
  const [introOpen, setIntroOpen] = useState(false);
  const [lastIntroKey, setLastIntroKey] = useState<string | null>(null);

  const introductions = data?.introductions ?? [];
  const introIds = introductions.map((i) => i._id);
  const introIdsKey = introIds.join(",");

  // Render-time sync: when the set of intros first arrives or changes (e.g. a
  // new intro is published by the owner), reopen the dialog if any id hasn't
  // been acknowledged yet. Mirrors the `edit-group-dialog` pattern of syncing
  // derived state during render rather than in an effect.
  if (introIdsKey !== lastIntroKey) {
    setLastIntroKey(introIdsKey);
    if (introIds.length > 0) {
      const seen = new Set(readSeenIntros(contactId));
      if (introIds.some((id) => !seen.has(id))) {
        setIntroOpen(true);
      }
    }
  }

  function handleIntroOpenChange(next: boolean) {
    setIntroOpen(next);
    if (!next && introIds.length > 0) {
      markIntrosSeen(contactId, introIds);
    }
  }

  if (data === undefined) return <Loader size="md" />;

  if (data === null) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-12 rounded-2xl">
          <h3 className="text-headline-sm text-primary">
            {t("memorial.noAccess.title")}
          </h3>
          <p className="text-body-md text-on-surface-variant mt-2 text-center max-w-md">
            {t("memorial.noAccess.description")}
          </p>
          <Link
            href="/shared-with-me"
            className="text-body-md font-bold text-secondary hover:underline mt-4"
          >
            {t("memorial.back")}
          </Link>
        </div>
      </div>
    );
  }

  const { owner, items } = data;

  return (
    <div className="max-w-screen-xl mx-auto">
      <header className="mb-8 max-w-3xl">
        <Link
          href="/shared-with-me"
          className="text-label-md text-on-surface-variant hover:text-primary"
        >
          ← {t("memorial.backShort")}
        </Link>
        <h1 className="text-headline-lg text-primary mt-3 mb-2">
          {t("memorial.title", { ownerName: owner.name })}
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          {items.length === 1
            ? t("memorial.subtitleOne", {
                count: items.length,
                ownerName: owner.name,
              })
            : t("memorial.subtitleOther", {
                count: items.length,
                ownerName: owner.name,
              })}
        </p>
      </header>

      {introductions.length > 0 && (
        <section className="mb-12 bg-surface-container-low rounded-3xl p-8 space-y-8 max-w-3xl">
          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <p className="text-label-md text-secondary">
                {t("memorial.messageFrom", { ownerName: owner.name })}
              </p>
              <button
                type="button"
                onClick={() => setIntroOpen(true)}
                className="text-label-md font-bold text-secondary hover:underline cursor-pointer"
              >
                {t("memorial.rereadMessage")}
              </button>
            </div>
            <div className="h-px bg-outline-variant/30" />
          </div>
          {introductions.map((intro) => (
            <MemorialIntroductionCard
              key={intro._id}
              contactId={contactId}
              intro={intro}
            />
          ))}
        </section>
      )}

      {items.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">
          {t("memorial.noReadableItems")}
        </p>
      ) : (
        <div className="space-y-10">
          {sortedCategories.map((cat) => {
            const catItems = items.filter((i) => i.category === cat.key);
            if (catItems.length === 0) return null;
            return (
              <section key={cat.key}>
                <div className="flex items-center gap-2 mb-4">
                  <Icon path={cat.icon} className="w-5 h-5 text-secondary" />
                  <h2 className="text-headline-sm text-primary">
                    {categoryLabel(cat.key)}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catItems.map((item) =>
                    item.readable ? (
                      <Link
                        key={item._id}
                        href={`/shared-with-me/${contactId}/memorial/${item._id}`}
                        className="bg-surface-container-low hover:bg-surface-container transition-colors p-5 rounded-2xl block"
                      >
                        <p className="text-headline-sm text-primary truncate">
                          {titles[item._id] ?? ""}
                        </p>
                        <p className="text-label-md text-on-surface-variant mt-1">
                          {item.hasFiles
                            ? t("memorial.includesAttachments")
                            : ""}
                          {t("memorial.read")} →
                        </p>
                      </Link>
                    ) : (
                      <div
                        key={item._id}
                        className="bg-surface-container-low/60 p-5 rounded-2xl opacity-60"
                      >
                        <p className="text-headline-sm text-primary truncate">
                          {titles[item._id] ?? ""}
                        </p>
                        <p className="text-label-md text-on-surface-variant mt-1">
                          {t("memorial.unavailableLegacy")}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {introductions.length > 0 && (
        <MemorialIntroductionDialog
          open={introOpen}
          onOpenChange={handleIntroOpenChange}
          ownerName={owner.name}
          contactId={contactId}
          introductions={introductions}
        />
      )}
    </div>
  );
}
