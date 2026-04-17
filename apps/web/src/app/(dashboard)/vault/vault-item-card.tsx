"use client";

import Link from "next/link";
import { getCategoryConfig } from "@/lib/vault-categories";
import type { Doc } from "@keeplas/backend/_generated/dataModel";

interface VaultItemCardProps {
  item: Doc<"vault_items">;
}

export function VaultItemCard({ item }: VaultItemCardProps) {
  const category = getCategoryConfig(item.category);

  return (
    <Link
      href={`/vault/${item._id}`}
      className={`block p-6 rounded-full transition-all group cursor-pointer space-y-4 ${
        item.isCritical
          ? "bg-primary-container text-on-primary-container hover:bg-primary-container/90"
          : "bg-surface-container hover:bg-surface-container-high"
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`p-3 rounded-xl shadow-sm transition-colors ${
            item.isCritical
              ? "bg-primary text-on-primary"
              : "bg-surface-container-lowest text-primary group-hover:bg-secondary group-hover:text-on-secondary"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={category.icon} />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          {item.isCritical && (
            <span className="text-[10px] font-label font-bold uppercase tracking-widest text-secondary-fixed bg-secondary-fixed/20 px-2 py-0.5 rounded-lg">
              Critical
            </span>
          )}
          <svg
            className={`w-4 h-4 ${item.isCritical ? "text-secondary-fixed" : "text-secondary"}`}
            fill="currentColor" viewBox="0 0 24 24"
          >
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2Z" />
          </svg>
        </div>
      </div>

      <div>
        <h3
          className={`font-bold text-lg ${item.isCritical ? "text-on-primary" : "text-primary"}`}
        >
          {item.title}
        </h3>
        <p
          className={`text-[10px] uppercase tracking-widest mt-1 ${
            item.isCritical ? "text-on-primary-container/70" : "text-on-surface-variant"
          }`}
        >
          Updated {formatDate(item.updatedAt)}
        </p>
      </div>

      {item.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className={`text-[10px] font-label font-bold px-2 py-0.5 rounded-lg ${
                item.isCritical
                  ? "bg-surface-container-lowest/10 text-on-primary-container/60"
                  : "bg-surface-container-lowest text-on-surface-variant"
              }`}
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 3 && (
            <span className="text-[10px] text-on-surface-variant">
              +{item.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}
