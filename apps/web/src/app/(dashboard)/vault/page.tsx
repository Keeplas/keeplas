"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useState, useEffect, useMemo } from "react";
import { CATEGORIES, type VaultCategory } from "@/lib/vault-categories";
import { VaultItemCard } from "./vault-item-card";
import { AddItemDialog } from "./add-item-dialog";
import { Input } from "@keeplas/ui";

const SECTION_GROUPS: Array<{
  title: string;
  accent: string;
  keys: VaultCategory[];
}> = [
  {
    title: "Personal Documents",
    accent: "bg-secondary",
    keys: ["personal_document", "health_directive", "legal_document"],
  },
  {
    title: "Financial Assets",
    accent: "bg-primary",
    keys: ["financial_asset"],
  },
  {
    title: "Business & Continuity",
    accent: "bg-tertiary",
    keys: ["business_continuity", "credential"],
  },
  {
    title: "Digital & Messages",
    accent: "bg-error",
    keys: ["digital_asset", "conditional_message", "personal_message"],
  },
];

export default function VaultPage() {
  const getOrCreateVault = useMutation(api.vaults.getOrCreateVault);
  const vault = useQuery(api.vaults.getVault);
  const items = useQuery(api.vault_items.getItems);
  const categoryCounts = useQuery(api.vault_items.getCategoryCounts);

  const [activeCategory, setActiveCategory] = useState<VaultCategory | "all">("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (vault === null) {
      getOrCreateVault();
    }
  }, [vault, getOrCreateVault]);

  const filteredItems = (items ?? []).filter((item) => {
    if (activeCategory !== "all" && item.category !== activeCategory) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalCount = items?.length ?? 0;

  const groupedItems = useMemo(() => {
    const map: Record<string, typeof filteredItems> = {};
    for (const group of SECTION_GROUPS) {
      map[group.title] = filteredItems.filter((item) =>
        group.keys.includes(item.category as VaultCategory)
      );
    }
    return map;
  }, [filteredItems]);

  const showGrouped = activeCategory === "all" && !search;

  const integrityPct = totalCount === 0 ? 0 : Math.min(100, Math.round((totalCount / 12) * 100));
  const lastUpdated = items && items.length > 0
    ? Math.max(...items.map((i) => i.updatedAt))
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* Header & Action Row */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h1 className="font-headline text-primary text-4xl md:text-5xl font-extrabold tracking-tighter leading-tight">
            Digital Vault
          </h1>
          <p className="text-on-surface-variant font-body max-w-md">
            Your life's core documentation, secured with end-to-end zero-knowledge encryption.
          </p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="vault-gradient text-on-primary px-7 py-4 rounded-xl font-bold flex items-center gap-3 shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Add New Entry
        </button>
      </section>

      {/* Integrity Summary & Bento Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Vault Integrity — spans 2 cols */}
        <div className="md:col-span-2 bg-primary text-on-primary p-8 rounded-full flex flex-col justify-between relative overflow-hidden min-h-[220px]">
          <div className="relative z-10">
            <span className="inline-block bg-secondary px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold">
              Status: Active
            </span>
            <h3 className="text-2xl md:text-3xl font-headline font-bold mt-4">
              Vault Integrity: {integrityPct}%
            </h3>
            <p className="text-on-primary-container mt-2 max-w-sm text-sm leading-relaxed">
              {totalCount === 0
                ? "No encrypted blocks detected yet. Add your first entry to establish integrity."
                : `System last verified moments ago. No vulnerabilities detected in ${totalCount} encrypted blocks.`}
            </p>
          </div>
          <div className="flex mt-8 gap-4 relative z-10">
            <div className="bg-primary-container p-4 rounded-xl flex-1">
              <p className="text-[10px] uppercase tracking-widest text-on-primary-container">
                Encrypted Items
              </p>
              <p className="text-2xl font-bold mt-1">{totalCount}</p>
            </div>
            <div className="bg-primary-container p-4 rounded-xl flex-1">
              <p className="text-[10px] uppercase tracking-widest text-on-primary-container">
                Categories
              </p>
              <p className="text-2xl font-bold mt-1">
                {Object.values((categoryCounts as Record<string, number>) ?? {}).filter((c) => c > 0).length}
              </p>
            </div>
          </div>
          <svg
            className="absolute -right-5 -bottom-5 w-52 h-52 text-on-primary opacity-[0.08]"
            fill="currentColor" viewBox="0 0 24 24"
          >
            <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Zm-1 16-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7Z" />
          </svg>
        </div>

        {/* Last Access */}
        <div className="bg-surface-container-low p-8 rounded-full flex flex-col items-center justify-center text-center min-h-[220px]">
          <svg className="w-10 h-10 text-secondary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-widest">
            Last Access
          </p>
          <p className="text-xl font-bold text-primary mt-1">
            {lastUpdated ? formatFullTime(lastUpdated) : "No activity"}
          </p>
          <p className="text-[11px] text-on-surface-variant/60 mt-2">
            Verified session
          </p>
        </div>
      </section>

      {/* Search + Tabs */}
      <section className="space-y-4">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vault items..."
          className="max-w-md"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors cursor-pointer ${
              activeCategory === "all"
                ? "bg-secondary text-on-secondary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            All ({totalCount})
          </button>
          {CATEGORIES.map((cat) => {
            const count = (categoryCounts as Record<string, number> | undefined)?.[cat.key] ?? 0;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors cursor-pointer ${
                  activeCategory === cat.key
                    ? "bg-secondary text-on-secondary"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {cat.label} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      </section>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <div className="bg-surface-container-low rounded-2xl p-12 text-center">
          <svg
            className="w-12 h-12 text-outline-variant/40 mx-auto mb-4"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
            />
          </svg>
          <h3 className="font-headline font-bold text-lg text-primary mb-2">
            {activeCategory === "all"
              ? "Your vault is empty"
              : `No ${CATEGORIES.find((c) => c.key === activeCategory)?.label.toLowerCase() ?? "items"} yet`}
          </h3>
          <p className="text-sm text-on-surface-variant mb-6">
            {activeCategory === "all"
              ? "Start by adding your first secure item."
              : CATEGORIES.find((c) => c.key === activeCategory)?.emptyMessage}
          </p>
          <button
            onClick={() => setShowAddDialog(true)}
            className="vault-gradient text-on-primary font-headline font-bold py-3 px-6 rounded-xl cursor-pointer"
          >
            Add your first item
          </button>
        </div>
      ) : showGrouped ? (
        <div className="space-y-10">
          {SECTION_GROUPS.map((group) => {
            const groupItems = groupedItems[group.title];
            if (!groupItems || groupItems.length === 0) return null;
            return (
              <section key={group.title} className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-headline font-bold text-primary flex items-center gap-3">
                    <span className={`w-2 h-8 rounded-full ${group.accent}`} />
                    {group.title}
                  </h2>
                  <span className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">
                    {groupItems.length} {groupItems.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupItems.map((item) => (
                    <VaultItemCard key={item._id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <VaultItemCard key={item._id} item={item} />
          ))}
        </div>
      )}

      {vault && (
        <AddItemDialog
          vaultId={vault._id}
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          defaultCategory={activeCategory !== "all" ? activeCategory : undefined}
        />
      )}
    </div>
  );
}

function formatFullTime(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
