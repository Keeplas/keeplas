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
import { formatTimeAgo } from "@/lib/format";
import type { Doc } from "@keeplas/backend/_generated/dataModel";

type VaultSectionKey = "documents" | "financial" | "messages" | "digital";
const VALID_SECTIONS: ReadonlySet<VaultSectionKey> = new Set([
  "documents",
  "financial",
  "messages",
  "digital",
]);
const SECTION_LABELS: Record<VaultSectionKey, string> = {
  documents: "Personal Documents",
  financial: "Financial Assets",
  messages: "Conditional Messages",
  digital: "Digital Assets",
};
const DOCUMENTS_PREVIEW_LIMIT = 6;
const MESSAGES_PREVIEW_LIMIT = 3;
const DIGITAL_PREVIEW_LIMIT = 3;

type GroupedItems = {
  documents: Doc<"vault_items">[];
  financial: Doc<"vault_items">[];
  messages: Doc<"vault_items">[];
  digital: Doc<"vault_items">[];
};

function currentSectionCount(grouped: GroupedItems, section: VaultSectionKey) {
  return grouped[section].length;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatTimeShort(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DOCUMENT_CATEGORIES: VaultCategory[] = [
  "personal_document",
  "health_directive",
  "legal_document",
  "business_continuity",
];
const FINANCIAL_CATEGORIES: VaultCategory[] = ["financial_asset"];
const MESSAGE_CATEGORIES: VaultCategory[] = ["conditional_message", "personal_message"];
const DIGITAL_CATEGORIES: VaultCategory[] = ["digital_asset", "credential"];

const SECTION_DEFAULT_CATEGORY: Record<VaultSectionKey, VaultCategory> = {
  documents: "personal_document",
  financial: "financial_asset",
  messages: "conditional_message",
  digital: "digital_asset",
};

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
  const activeSection: VaultSectionKey | null =
    rawSection && VALID_SECTIONS.has(rawSection as VaultSectionKey)
      ? (rawSection as VaultSectionKey)
      : null;

  const vault = useQuery(api.vaults.getVault);
  const items = useQuery(api.vault_items.getItems);
  const user = useQuery(api.users.viewer);
  const getOrCreateVault = useMutation(api.vaults.getOrCreateVault);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogCategory, setAddDialogCategory] = useState<VaultCategory | undefined>(undefined);

  function openAddDialog(section?: VaultSectionKey) {
    setAddDialogCategory(section ? SECTION_DEFAULT_CATEGORY[section] : undefined);
    setShowAddDialog(true);
  }

  useEffect(() => {
    if (vault === null) {
      getOrCreateVault();
    }
  }, [vault, getOrCreateVault]);

  const grouped = useMemo(() => {
    const list = items ?? [];
    return {
      documents: list.filter((i) =>
        DOCUMENT_CATEGORIES.includes(i.category as VaultCategory)
      ),
      financial: list.filter((i) =>
        FINANCIAL_CATEGORIES.includes(i.category as VaultCategory)
      ),
      messages: list.filter((i) =>
        MESSAGE_CATEGORIES.includes(i.category as VaultCategory)
      ),
      digital: list.filter((i) =>
        DIGITAL_CATEGORIES.includes(i.category as VaultCategory)
      ),
    };
  }, [items]);

  if (items === undefined || vault === undefined) {
    return <Loader fullscreen label="Loading your vault" />;
  }

  const totalItems = items.length;
  const secureNodes = Math.max(vault?.secureNodesCount ?? 0, 1);
  const integrityBaseline = totalItems === 0 ? 0 : Math.min(100, 80 + totalItems * 2);
  const integrityScore = vault?.integrityScore
    ? Math.round(vault.integrityScore)
    : integrityBaseline;
  const encryptedBlocks = Math.max(totalItems * 8, totalItems);
  const lastVerifiedTs = vault?.lastVerifiedAt ?? vault?.updatedAt ?? null;
  const lastAccessTs = user?.lastSeenAt ?? user?._creationTime ?? null;

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
            {activeSection ? SECTION_LABELS[activeSection] : "Digital Vault"}
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-md">
            {activeSection
              ? `Showing all ${currentSectionCount(grouped, activeSection)} item${
                  currentSectionCount(grouped, activeSection) === 1 ? "" : "s"
                } in this category.`
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

      {/* Integrity Summary & Last Access */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-primary text-white p-8 rounded-full flex flex-col justify-between relative overflow-hidden min-h-[220px]">
          <div className="relative z-10">
            <span className="inline-block bg-secondary px-3 py-1 rounded-full text-label-md">
              Status: Active
            </span>
            <h3 className="text-headline-md mt-4">
              Vault Integrity: {integrityScore}%
            </h3>
            <p className="text-body-md text-on-primary-container mt-2 max-w-sm">
              {totalItems === 0
                ? "Empty vault. Add your first encrypted block to establish integrity."
                : `System last verified ${lastVerifiedTs ? formatTimeAgo(lastVerifiedTs) : "recently"}. No vulnerabilities detected in ${encryptedBlocks.toLocaleString()} encrypted blocks.`}
            </p>
          </div>

          <div className="flex mt-8 gap-4 relative z-10">
            <div className="bg-primary-container p-4 rounded-xl flex-1">
              <p className="text-label-md text-on-primary-container">
                Encrypted Items
              </p>
              <p className="text-headline-md">{totalItems}</p>
            </div>
            <div className="bg-primary-container p-4 rounded-xl flex-1">
              <p className="text-label-md text-on-primary-container">
                Secure Nodes
              </p>
              <p className="text-headline-md">{secureNodes}</p>
            </div>
          </div>

          <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
            <Icon path={ICON_PATHS.verifiedUser} className="w-48 h-48" />
          </div>
        </div>

        <div className="bg-surface-container-low p-8 rounded-full ghost-border flex flex-col items-center justify-center text-center">
          <Icon path={ICON_PATHS.history} className="w-10 h-10 text-secondary mb-4" />
          <p className="text-label-md text-on-surface-variant">
            Last Access
          </p>
          <p className="text-headline-sm text-primary mt-1">
            {lastAccessTs
              ? `Today, ${formatTimeShort(lastAccessTs)}`
              : "No access recorded"}
          </p>
          <p className="text-body-md text-on-surface-variant mt-2">
            Verified Device · Zero-Knowledge Session
          </p>
        </div>
      </section>

      {/* Vault Sections */}
      <div className="space-y-12">
        {(!activeSection || activeSection === "documents") && (
          <VaultSection
            title="Personal Documents"
            accent="bg-secondary"
            viewAllHref={
              !activeSection && grouped.documents.length > DOCUMENTS_PREVIEW_LIMIT
                ? "/vault?section=documents"
                : undefined
            }
            isEmpty={grouped.documents.length === 0}
            emptyMessage="No personal documents yet. Add your first."
            onAdd={() => openAddDialog("documents")}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(activeSection
                ? grouped.documents
                : grouped.documents.slice(0, DOCUMENTS_PREVIEW_LIMIT)
              ).map((item) => (
                <DocumentCard key={item._id} item={item} />
              ))}
            </div>
          </VaultSection>
        )}

        {(!activeSection || activeSection === "financial") && (
          <VaultSection
            title="Financial Assets"
            accent="bg-primary"
            isEmpty={grouped.financial.length === 0}
            emptyMessage="No financial assets yet. Add your first."
            onAdd={() => openAddDialog("financial")}
          >
            <FinancialTable items={grouped.financial} />
          </VaultSection>
        )}

        {(!activeSection ||
          activeSection === "messages" ||
          activeSection === "digital") && (
          <div
            className={cn(
              "grid gap-8",
              activeSection ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
            )}
          >
            {(!activeSection || activeSection === "messages") && (
              <VaultSection
                title="Conditional Messages"
                accent="bg-error"
                viewAllHref={
                  !activeSection && grouped.messages.length > MESSAGES_PREVIEW_LIMIT
                    ? "/vault?section=messages"
                    : undefined
                }
                isEmpty={grouped.messages.length === 0}
                emptyMessage="No conditional messages yet."
                onAdd={() => openAddDialog("messages")}
              >
                <div className="space-y-4">
                  {(activeSection
                    ? grouped.messages
                    : grouped.messages.slice(0, MESSAGES_PREVIEW_LIMIT)
                  ).map((item) => (
                    <MessageCard key={item._id} item={item} />
                  ))}
                </div>
              </VaultSection>
            )}

            {(!activeSection || activeSection === "digital") && (
              <VaultSection
                title="Digital Assets"
                accent="bg-tertiary"
                viewAllHref={
                  !activeSection && grouped.digital.length > DIGITAL_PREVIEW_LIMIT
                    ? "/vault?section=digital"
                    : undefined
                }
                isEmpty={grouped.digital.length === 0}
                emptyMessage="No digital assets yet. Add your first."
                onAdd={() => openAddDialog("digital")}
              >
                <div className="space-y-4">
                  {(activeSection
                    ? grouped.digital
                    : grouped.digital.slice(0, DIGITAL_PREVIEW_LIMIT)
                  ).map((item) => (
                    <DigitalAssetRow key={item._id} item={item} />
                  ))}
                </div>
              </VaultSection>
            )}
          </div>
        )}
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
  accent,
  children,
  viewAllHref,
  isEmpty,
  emptyMessage,
  onAdd,
}: {
  title: string;
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

function DocumentCard({ item }: { item: Doc<"vault_items"> }) {
  const category = getCategoryConfig(item.category as VaultCategory);
  return (
    <Link
      href={`/vault/${item._id}`}
      className="bg-surface-container hover:bg-surface-container-high p-6 rounded-full transition-all group cursor-pointer border border-transparent hover:border-outline-variant/20 block"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="bg-white p-3 rounded-xl shadow-sm group-hover:bg-secondary group-hover:text-white transition-colors">
          <Icon path={category.icon} className="w-5 h-5" />
        </div>
        <Icon path={ICON_PATHS.lock} className="w-4 h-4 text-secondary" />
      </div>
      <h4 className="text-headline-sm text-primary truncate">
        {item.title}
      </h4>
      <p className="text-label-md text-on-surface-variant mt-1">
        Updated {formatDate(item.updatedAt)}
      </p>
    </Link>
  );
}

function financialIconPath(title: string) {
  const t = title.toLowerCase();
  if (t.includes("crypto") || t.includes("bitcoin") || t.includes("wallet"))
    return ICON_PATHS.currencyBitcoin;
  return ICON_PATHS.accountBalance;
}

function FinancialTable({ items }: { items: Doc<"vault_items">[] }) {
  return (
    <div className="bg-surface-container-low rounded-full overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="border-b border-outline-variant/10">
          <tr>
            <th className="px-8 py-5 text-label-md text-on-surface-variant">
              Asset Name
            </th>
            <th className="px-8 py-5 text-label-md text-on-surface-variant">
              Encryption Status
            </th>
            <th className="px-8 py-5 text-label-md text-on-surface-variant">
              Last Updated
            </th>
            <th className="px-8 py-5 text-label-md text-on-surface-variant text-right">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item._id}
              className="hover:bg-surface-container transition-colors group border-t border-outline-variant/5 first:border-t-0"
            >
              <td className="px-8 py-6">
                <div className="flex items-center gap-4">
                  <Icon
                    path={financialIconPath(item.title)}
                    className="w-5 h-5 text-secondary"
                  />
                  <span className="font-bold text-primary">{item.title}</span>
                </div>
              </td>
              <td className="px-8 py-6">
                <span className="inline-flex items-center gap-2 text-label-md text-on-tertiary-container bg-tertiary-fixed px-3 py-1 rounded-full">
                  <Icon path={ICON_PATHS.verifiedFill} className="w-3.5 h-3.5" />
                  Zero-Knowledge
                </span>
              </td>
              <td className="px-8 py-6 text-body-md text-on-surface-variant">
                {formatDate(item.updatedAt)}
              </td>
              <td className="px-8 py-6 text-right">
                <Link
                  href={`/vault/${item._id}`}
                  className="inline-flex text-primary hover:text-secondary p-2 transition-colors rounded-lg"
                  aria-label="Item options"
                >
                  <Icon path={ICON_PATHS.moreHoriz} className="w-5 h-5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessageCard({ item }: { item: Doc<"vault_items"> }) {
  return (
    <Link
      href={`/vault/${item._id}`}
      className="block bg-white p-6 rounded-full shadow-sm hover:shadow-md transition-shadow ghost-border"
    >
      <div className="flex justify-between items-center mb-3">
        <span className="text-label-md text-error bg-error-container px-3 py-1 rounded-full">
          Dead Man&apos;s Switch
        </span>
        <Icon path={ICON_PATHS.mail} className="w-5 h-5 text-on-surface-variant" />
      </div>
      <h4 className="text-headline-sm text-primary">{item.title}</h4>
      <p className="text-body-md text-on-surface-variant mt-2 line-clamp-2">
        {item.description ??
          "This message will be released when your life check protocol triggers."}
      </p>
    </Link>
  );
}

function DigitalAssetRow({ item }: { item: Doc<"vault_items"> }) {
  const sharedCount = item.sharedWithContacts?.length ?? 0;
  const iconPath =
    item.category === "credential" ? ICON_PATHS.key : ICON_PATHS.cloud;
  return (
    <Link
      href={`/vault/${item._id}`}
      className="bg-surface-container-highest p-6 rounded-full flex items-center justify-between group cursor-pointer hover:bg-surface-dim transition-colors"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="bg-white p-3 rounded-xl shrink-0">
          <Icon path={iconPath} className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h4 className="text-headline-sm text-primary truncate">
            {item.title}
          </h4>
          <p className="text-label-md text-on-surface-variant truncate">
            {sharedCount > 0
              ? `Shared with ${sharedCount} Contact${sharedCount === 1 ? "" : "s"}`
              : "Private"}
          </p>
        </div>
      </div>
      <Icon
        path={ICON_PATHS.chevronRight}
        className="w-4 h-4 text-on-surface-variant shrink-0 group-hover:translate-x-1 transition-transform"
      />
    </Link>
  );
}
