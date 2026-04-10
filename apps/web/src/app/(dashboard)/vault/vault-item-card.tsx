"use client";

import { useState } from "react";
import Link from "next/link";
import { getCategoryConfig } from "@/lib/vault-categories";
import type { Doc } from "@keeplas/backend/_generated/dataModel";

interface VaultItemCardProps {
  item: Doc<"vault_items">;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export function VaultItemCard({ item }: VaultItemCardProps) {
  const category = getCategoryConfig(item.category);
  const [isRecent] = useState(() => Date.now() - item.updatedAt < DAY_MS);

  return (
    <Link
      href={`/vault/${item._id}`}
      className={`block p-5 rounded-2xl transition-all hover:shadow-md cursor-pointer ${
        item.isCritical
          ? "bg-primary-container text-on-primary-container"
          : "bg-surface-container-low hover:bg-surface-container-high"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg
            className={`w-5 h-5 shrink-0 ${item.isCritical ? "text-secondary-fixed" : "text-secondary"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={category.icon} />
          </svg>
          <span
            className={`font-label text-[10px] uppercase tracking-widest font-bold ${
              item.isCritical ? "text-on-primary-container/60" : "text-on-surface-variant"
            }`}
          >
            {category.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {item.isCritical && (
            <span className="text-[10px] font-label font-bold uppercase tracking-widest text-secondary-fixed bg-secondary-fixed/20 px-2 py-0.5 rounded-lg">
              Critical
            </span>
          )}
          {isRecent && !item.isCritical && (
            <span className="w-2 h-2 rounded-full bg-secondary" />
          )}
        </div>
      </div>

      <h3
        className={`font-headline font-bold text-base mb-1 ${
          item.isCritical ? "text-surface-container-lowest" : "text-primary"
        }`}
      >
        {item.title}
      </h3>

      {item.description && (
        <p
          className={`text-sm line-clamp-2 ${
            item.isCritical ? "text-on-primary-container/70" : "text-on-surface-variant"
          }`}
        >
          {item.description}
        </p>
      )}

      <div className="flex items-center gap-3 mt-3">
        {item.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className={`text-[10px] font-label font-bold px-2 py-0.5 rounded-lg ${
              item.isCritical
                ? "bg-surface-container-lowest/10 text-on-primary-container/60"
                : "bg-surface-container text-on-surface-variant"
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
    </Link>
  );
}
