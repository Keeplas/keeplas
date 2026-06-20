import { Link } from "@/lib/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "@/lib/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { cn, Icon, Loader } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { AddItemDialog } from "@/components/add-item-dialog";
import { ReleaseIntroductionEditor } from "@/app/(dashboard)/life-check/sections/release-introduction-editor";
import { ICON_PATHS } from "@/lib/icons";
import { getCategoryConfig, type VaultCategory } from "@/lib/vault-categories";
import { useDecryptedTitles } from "@/lib/use-decrypted-titles";
import { useBackfillItemTitles } from "@/lib/use-backfill-item-titles";
import type { Doc } from "@keeplas/backend/_generated/dataModel";

interface SectionConfig {
  key: string;
  category: VaultCategory;
  accent: string;
}

// One section per category. Health Directives, Legal Documents, and Business
// Continuity are top-level here so they don't collapse into "Personal
// Documents" — each category has its own intent and own UI affordances.
// Labels and empty-state messages resolve via t("sections.<key>.*") in render.
const SECTIONS: SectionConfig[] = [
  {
    key: "documents",
    category: "personal_document",
    accent: "bg-secondary",
  },
  {
    key: "health",
    category: "health_directive",
    accent: "bg-error",
  },
  {
    key: "legal",
    category: "legal_document",
    accent: "bg-primary",
  },
  {
    key: "business",
    category: "business_continuity",
    accent: "bg-tertiary",
  },
  {
    key: "financial",
    category: "financial_asset",
    accent: "bg-secondary",
  },
  {
    key: "credentials",
    category: "credential",
    accent: "bg-primary",
  },
  {
    key: "digital",
    category: "digital_asset",
    accent: "bg-tertiary",
  },
  {
    key: "messages",
    category: "conditional_message",
    accent: "bg-error",
  },
];

const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));
const PREVIEW_LIMIT = 3;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default function VaultPage() {
  return (
    <Suspense fallback={<VaultLoader />}>
      <VaultPageContent />
    </Suspense>
  );
}

function VaultLoader() {
  const t = useTranslations("vault");
  return <Loader fullscreen label={t("page.loading")} />;
}

function VaultPageContent() {
  const t = useTranslations("vault");
  const searchParams = useSearchParams();
  const rawSection = searchParams.get("section");
  const activeSection = rawSection
    ? (SECTION_BY_KEY.get(rawSection) ?? null)
    : null;

  const vault = useQuery(api.vaults.getVault);
  const items = useQuery(api.vault_items.getItems);
  const titles = useDecryptedTitles(items);
  // Owner-side migration of any legacy plaintext titles still in the vault.
  useBackfillItemTitles(items);
  const recipientGroups = useQuery(api.recipient_groups.listGroups) ?? [];
  const allContacts = useQuery(api.trusted_contacts.getContacts) ?? [];
  const getOrCreateVault = useMutation(api.vaults.getOrCreateVault);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogCategory, setAddDialogCategory] = useState<
    VaultCategory | undefined
  >(undefined);

  function openAddDialog(section?: SectionConfig) {
    setAddDialogCategory(section?.category);
    setShowAddDialog(true);
  }

  useEffect(() => {
    if (vault === null) {
      getOrCreateVault();
    }
  }, [vault, getOrCreateVault]);

  const itemsByCategory = useMemo(() => {
    const map = new Map<VaultCategory, Doc<"vault_items">[]>();
    for (const section of SECTIONS) {
      map.set(section.category, []);
    }
    for (const item of items ?? []) {
      const list = map.get(item.category as VaultCategory);
      if (list) list.push(item);
    }
    return map;
  }, [items]);

  if (items === undefined || vault === undefined) {
    return <Loader fullscreen label={t("page.loading")} />;
  }

  const sectionsToRender = activeSection ? [activeSection] : SECTIONS;
  const activeCount = activeSection
    ? (itemsByCategory.get(activeSection.category)?.length ?? 0)
    : 0;

  return (
    <div className="max-w-screen-2xl mx-auto space-y-10">
      {/* Header */}
      <header className="space-y-2">
        {activeSection && (
          <Link
            href="/vault"
            className="inline-flex items-center gap-2 text-label-md text-on-surface-variant hover:text-primary transition-colors"
          >
            <Icon
              path={ICON_PATHS.chevronRight}
              className="w-4 h-4 rotate-180"
            />
            {t("page.allSections")}
          </Link>
        )}
        <h1 className="text-headline-lg text-primary">
          {activeSection
            ? t(`sections.${activeSection.key}.label`)
            : t("page.title")}
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-md">
          {activeSection
            ? t(activeCount === 1 ? "page.countOne" : "page.countOther", {
                count: activeCount,
              })
            : t("page.subtitle")}
        </p>
      </header>

      {/* Welcome message editor — sits above categories so users see it
          immediately on the main /vault landing. Hidden when drilling into a
          single category to keep that view focused on items. */}
      {!activeSection && <ReleaseIntroductionEditor />}

      {/* Vault Sections */}
      <div className="space-y-12">
        {sectionsToRender.map((section) => {
          const sectionItems = itemsByCategory.get(section.category) ?? [];
          const visibleItems = activeSection
            ? sectionItems
            : sectionItems.slice(0, PREVIEW_LIMIT);
          return (
            <VaultSection
              key={section.key}
              title={t(`sections.${section.key}.label`)}
              count={sectionItems.length}
              accent={section.accent}
              viewAllHref={
                !activeSection && sectionItems.length > PREVIEW_LIMIT
                  ? `/vault?section=${section.key}`
                  : undefined
              }
              isEmpty={sectionItems.length === 0}
              emptyMessage={t(`sections.${section.key}.empty`)}
              onAdd={() => openAddDialog(section)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleItems.map((item) => (
                  <VaultItemCard
                    key={item._id}
                    item={item}
                    title={titles[item._id] ?? ""}
                    groups={recipientGroups}
                    contacts={allContacts}
                  />
                ))}
              </div>
            </VaultSection>
          );
        })}
      </div>

      {vault && (
        <AddItemDialog
          vaultId={vault._id}
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          defaultCategory={addDialogCategory}
        />
      )}
    </div>
  );
}

function VaultSection({
  title,
  count,
  accent,
  children,
  viewAllHref,
  isEmpty,
  emptyMessage,
  onAdd,
}: {
  title: string;
  count?: number;
  accent: string;
  children: React.ReactNode;
  viewAllHref?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
  onAdd?: () => void;
}) {
  const t = useTranslations("vault");
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-headline-md flex items-center gap-3 text-primary min-w-0">
          <span className={cn("w-2 h-8 rounded-full shrink-0", accent)} />
          <span className="truncate">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="text-on-surface-variant shrink-0">({count})</span>
          )}
        </h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="shrink-0 text-secondary text-body-md font-bold hover:underline cursor-pointer"
          >
            {t("section.viewAll")}
          </Link>
        )}
      </div>
      {isEmpty ? (
        <div className="bg-surface-container-low rounded-full p-10 text-center">
          <p className="text-body-lg text-on-surface-variant mb-4">
            {emptyMessage}
          </p>
          {onAdd && (
            <button
              onClick={onAdd}
              className="text-secondary text-body-md font-bold hover:underline cursor-pointer"
            >
              {t("section.addEntry")}
            </button>
          )}
        </div>
      ) : (
        <>
          {children}
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="md:hidden flex items-center justify-center gap-2 mt-4 py-3 px-4 rounded-full bg-surface-container-low hover:bg-surface-container-high text-secondary font-label font-bold text-body-md transition-colors cursor-pointer"
            >
              {t("section.viewAllCount", { count: count ?? 0 })}
              <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
            </Link>
          )}
        </>
      )}
    </section>
  );
}

// Resolve the "Transmission Logic" summary for the card. Mirrors the
// dialog's recipient picker: a private item shows "Private", an item
// shared with the default group of trust contacts collapses to "All trust
// contacts", and explicit picks are listed by name (or counted when too
// many to fit on a card).
function transmissionSummary(
  item: Doc<"vault_items">,
  groups: Doc<"recipient_groups">[],
  contacts: Doc<"trusted_contacts">[],
  t: (key: string, params?: Record<string, string | number>) => string,
): { label: string; tone: "private" | "shared" } {
  if (item.accessLevel === "private") {
    return { label: t("transmission.private"), tone: "private" };
  }

  const mode = item.recipientMode ?? "default";
  if (mode === "explicit") {
    const names = (item.sharedWithContacts ?? [])
      .map((id) => contacts.find((c) => c._id === id)?.name)
      .filter((n): n is string => Boolean(n));
    if (names.length === 0)
      return { label: t("transmission.private"), tone: "private" };
    if (names.length === 1) return { label: names[0], tone: "shared" };
    if (names.length === 2) return { label: names.join(" & "), tone: "shared" };
    return { label: `${names[0]} +${names.length - 1}`, tone: "shared" };
  }

  if (mode === "groups") {
    const names = (item.sharedWithGroups ?? [])
      .map((id) => groups.find((g) => g._id === id)?.name)
      .filter((n): n is string => Boolean(n));
    if (names.length === 0)
      return { label: t("transmission.private"), tone: "private" };
    if (names.length === 1) return { label: names[0], tone: "shared" };
    return {
      label: t("transmission.groups", { count: names.length }),
      tone: "shared",
    };
  }

  // mode === "default" with non-private accessLevel: legacy "all trust
  // contacts" semantics.
  return { label: t("transmission.allContacts"), tone: "shared" };
}

// Single card used for every category. Top-right pill shows the
// transmission target (Private / contact / group / "All trust contacts").
function VaultItemCard({
  item,
  title,
  groups,
  contacts,
}: {
  item: Doc<"vault_items">;
  title: string;
  groups: Doc<"recipient_groups">[];
  contacts: Doc<"trusted_contacts">[];
}) {
  const t = useTranslations("vault");
  const category = getCategoryConfig(item.category as VaultCategory);
  const transmission = transmissionSummary(item, groups, contacts, t);

  return (
    <Link
      href={`/vault/${item._id}`}
      className="bg-surface-container hover:bg-surface-container-high p-6 rounded-full transition-all group cursor-pointer border border-transparent hover:border-outline-variant/20 block"
    >
      <div className="flex justify-between items-start gap-3 mb-4">
        <div className="bg-white p-3 rounded-xl shadow-sm group-hover:bg-secondary group-hover:text-white transition-colors shrink-0">
          <Icon path={category.icon} className="w-5 h-5" />
        </div>
        <span
          className="text-label-md normal-case tracking-normal text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full inline-flex items-center gap-1.5 max-w-[60%]"
          title={transmission.label}
        >
          <Icon
            path={
              transmission.tone === "private"
                ? ICON_PATHS.lock
                : ICON_PATHS.users
            }
            className="w-3 h-3 shrink-0"
          />
          <span className="truncate">{transmission.label}</span>
        </span>
      </div>
      <h4 className="text-headline-sm text-primary truncate">{title}</h4>
      <p className="text-label-md normal-case tracking-normal text-on-surface-variant mt-1">
        {t("card.updated", { date: formatDate(item.updatedAt) })}
      </p>
    </Link>
  );
}
