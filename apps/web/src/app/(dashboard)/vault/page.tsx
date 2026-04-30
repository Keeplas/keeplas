"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Button, cn, Icon, Loader } from "@keeplas/ui";
import { AddItemDialog } from "@/components/add-item-dialog";
import { ICON_PATHS } from "@/lib/icons";
import { getCategoryConfig, type VaultCategory } from "@/lib/vault-categories";
import type { Doc } from "@keeplas/backend/_generated/dataModel";

interface SectionConfig {
  key: string;
  label: string;
  category: VaultCategory;
  accent: string;
  emptyMessage: string;
}

// One section per category. Health Directives, Legal Documents, and Business
// Continuity are top-level here so they don't collapse into "Personal
// Documents" — each category has its own intent and own UI affordances.
const SECTIONS: SectionConfig[] = [
  {
    key: "documents",
    label: "Personal Documents",
    category: "personal_document",
    accent: "bg-secondary",
    emptyMessage: "No personal documents yet. Add your first.",
  },
  {
    key: "health",
    label: "Health Directives",
    category: "health_directive",
    accent: "bg-error",
    emptyMessage: "No health directives yet. Add your first.",
  },
  {
    key: "legal",
    label: "Legal Documents",
    category: "legal_document",
    accent: "bg-primary",
    emptyMessage: "No legal documents yet. Add your first.",
  },
  {
    key: "business",
    label: "Business Continuity",
    category: "business_continuity",
    accent: "bg-tertiary",
    emptyMessage: "No business continuity plans yet. Add your first.",
  },
  {
    key: "financial",
    label: "Financial Assets",
    category: "financial_asset",
    accent: "bg-secondary",
    emptyMessage: "No financial assets yet. Add your first.",
  },
  {
    key: "credentials",
    label: "Credentials",
    category: "credential",
    accent: "bg-primary",
    emptyMessage: "No credentials yet. Add your first.",
  },
  {
    key: "digital",
    label: "Digital Assets",
    category: "digital_asset",
    accent: "bg-tertiary",
    emptyMessage: "No digital assets yet. Add your first.",
  },
  {
    key: "messages",
    label: "Conditional Messages",
    category: "conditional_message",
    accent: "bg-error",
    emptyMessage: "No conditional messages yet.",
  },
];

const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));
const PREVIEW_LIMIT = 6;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default function VaultPage() {
  return (
    <Suspense fallback={<Loader fullscreen label="Loading your vault" />}>
      <VaultPageContent />
    </Suspense>
  );
}

function VaultPageContent() {
  const searchParams = useSearchParams();
  const rawSection = searchParams.get("section");
  const activeSection = rawSection ? SECTION_BY_KEY.get(rawSection) ?? null : null;

  const vault = useQuery(api.vaults.getVault);
  const items = useQuery(api.vault_items.getItems);
  const recipientGroups = useQuery(api.recipient_groups.listGroups) ?? [];
  const allContacts = useQuery(api.trusted_contacts.getContacts) ?? [];
  const getOrCreateVault = useMutation(api.vaults.getOrCreateVault);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogCategory, setAddDialogCategory] = useState<VaultCategory | undefined>(undefined);

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
    return <Loader fullscreen label="Loading your vault" />;
  }

  const sectionsToRender = activeSection ? [activeSection] : SECTIONS;
  const activeCount = activeSection
    ? itemsByCategory.get(activeSection.category)?.length ?? 0
    : 0;

  return (
    <div className="max-w-screen-2xl mx-auto space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          {activeSection && (
            <Link
              href="/vault"
              className="inline-flex items-center gap-2 text-label-md text-on-surface-variant hover:text-primary transition-colors"
            >
              <Icon path={ICON_PATHS.chevronRight} className="w-4 h-4 rotate-180" />
              All vault sections
            </Link>
          )}
          <h1 className="text-headline-lg text-primary">
            {activeSection ? activeSection.label : "Digital Vault"}
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-md">
            {activeSection
              ? `Showing all ${activeCount} item${activeCount === 1 ? "" : "s"} in this category.`
              : "Your life's core documentation, secured with end-to-end zero-knowledge encryption."}
          </p>
        </div>
        <Button
          variant="vault"
          size="lg"
          onClick={() => openAddDialog(activeSection ?? undefined)}
          className="shadow-2xl shadow-primary/20 cursor-pointer"
        >
          <Icon path={ICON_PATHS.plusCircle} className="w-5 h-5" />
          Add New Entry
        </Button>
      </header>

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
              title={section.label}
              count={sectionItems.length}
              accent={section.accent}
              viewAllHref={
                !activeSection && sectionItems.length > PREVIEW_LIMIT
                  ? `/vault?section=${section.key}`
                  : undefined
              }
              isEmpty={sectionItems.length === 0}
              emptyMessage={section.emptyMessage}
              onAdd={() => openAddDialog(section)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleItems.map((item) => (
                  <VaultItemCard
                    key={item._id}
                    item={item}
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
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-md flex items-center gap-3 text-primary">
          <span className={cn("w-2 h-8 rounded-full", accent)} />
          {title}
          {count !== undefined && count > 0 && (
            <span className="text-on-surface-variant">({count})</span>
          )}
        </h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-secondary text-body-md font-bold hover:underline cursor-pointer"
          >
            View All
          </Link>
        )}
      </div>
      {isEmpty ? (
        <div className="bg-surface-container-low rounded-full p-10 text-center">
          <p className="text-body-lg text-on-surface-variant mb-4">{emptyMessage}</p>
          {onAdd && (
            <button
              onClick={onAdd}
              className="text-secondary text-body-md font-bold hover:underline cursor-pointer"
            >
              Add entry
            </button>
          )}
        </div>
      ) : (
        children
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
  contacts: Doc<"trusted_contacts">[]
): { label: string; tone: "private" | "shared" } {
  if (item.accessLevel === "private") {
    return { label: "Private", tone: "private" };
  }

  const mode = item.recipientMode ?? "default";
  if (mode === "explicit") {
    const names = (item.sharedWithContacts ?? [])
      .map((id) => contacts.find((c) => c._id === id)?.name)
      .filter((n): n is string => Boolean(n));
    if (names.length === 0) return { label: "Private", tone: "private" };
    if (names.length === 1) return { label: names[0], tone: "shared" };
    if (names.length === 2) return { label: names.join(" & "), tone: "shared" };
    return { label: `${names[0]} +${names.length - 1}`, tone: "shared" };
  }

  if (mode === "groups") {
    const names = (item.sharedWithGroups ?? [])
      .map((id) => groups.find((g) => g._id === id)?.name)
      .filter((n): n is string => Boolean(n));
    if (names.length === 0) return { label: "Private", tone: "private" };
    if (names.length === 1) return { label: names[0], tone: "shared" };
    return { label: `${names.length} groups`, tone: "shared" };
  }

  // mode === "default" with non-private accessLevel: legacy "all trust
  // contacts" semantics.
  return { label: "All trust contacts", tone: "shared" };
}

// Single card used for every category. Top-right pill shows the
// transmission target (Private / contact / group / "All trust contacts").
// An "On Emergency Card" badge appears under the metadata when the item
// is published to the public emergency card.
function VaultItemCard({
  item,
  groups,
  contacts,
}: {
  item: Doc<"vault_items">;
  groups: Doc<"recipient_groups">[];
  contacts: Doc<"trusted_contacts">[];
}) {
  const category = getCategoryConfig(item.category as VaultCategory);
  const transmission = transmissionSummary(item, groups, contacts);
  const onEmergencyCard = item.accessLevel === "public";

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
      <h4 className="text-headline-sm text-primary truncate">
        {item.title}
      </h4>
      <p className="text-label-md normal-case tracking-normal text-on-surface-variant mt-1">
        Updated {formatDate(item.updatedAt)}
      </p>
      {onEmergencyCard && (
        <span className="mt-3 inline-flex items-center gap-1.5 text-label-md normal-case tracking-normal text-on-secondary-container bg-secondary-container px-3 py-1 rounded-full">
          <Icon path={ICON_PATHS.emergencyCard} className="w-3 h-3" />
          On Emergency Card
        </span>
      )}
    </Link>
  );
}
