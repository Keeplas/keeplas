"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useState, useEffect } from "react";
import { CATEGORIES, type VaultCategory } from "@/lib/vault-categories";
import { VaultItemCard } from "./vault-item-card";
import { AddItemDialog } from "./add-item-dialog";
import { Input } from "@keeplas/ui";

export default function VaultPage() {
  const getOrCreateVault = useMutation(api.vaults.getOrCreateVault);
  const vault = useQuery(api.vaults.getVault);
  const items = useQuery(api.vault_items.getItems);
  const categoryCounts = useQuery(api.vault_items.getCategoryCounts);

  const [activeCategory, setActiveCategory] = useState<VaultCategory | "all">("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [search, setSearch] = useState("");

  // Ensure vault exists
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

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <section className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <span className="font-label text-secondary font-semibold uppercase tracking-[0.2em] text-xs mb-3 block">
            Encrypted Storage
          </span>
          <h1 className="font-headline text-primary text-4xl md:text-5xl font-extrabold tracking-tighter leading-tight">
            Digital Vault
          </h1>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="vault-gradient text-on-primary font-headline font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Item
        </button>
      </section>

      {/* Search */}
      <div className="mb-6">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vault items..."
          className="max-w-md"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-4 py-2 rounded-xl text-sm font-label font-bold whitespace-nowrap transition-colors cursor-pointer ${
            activeCategory === "all"
              ? "bg-secondary text-on-secondary"
              : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
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
              className={`px-4 py-2 rounded-xl text-sm font-label font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeCategory === cat.key
                  ? "bg-secondary text-on-secondary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {cat.label} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-surface-container-low rounded-2xl p-12 text-center">
          <svg
            className="w-12 h-12 text-outline-variant/40 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <VaultItemCard key={item._id} item={item} />
          ))}
        </div>
      )}

      {/* Add Item Dialog */}
      {showAddDialog && vault && (
        <AddItemDialog
          vaultId={vault._id}
          onClose={() => setShowAddDialog(false)}
          defaultCategory={activeCategory !== "all" ? activeCategory : undefined}
        />
      )}
    </div>
  );
}
