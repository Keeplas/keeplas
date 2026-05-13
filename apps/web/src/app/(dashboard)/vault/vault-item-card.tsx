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
      className="block p-5 rounded-full transition-all group cursor-pointer space-y-3 bg-surface-container hover:bg-surface-container-high"
    >
      <div className="flex items-start justify-between">
        <div className="p-2.5 rounded-xl shadow-sm transition-colors bg-surface-container-lowest text-primary group-hover:bg-secondary group-hover:text-on-secondary">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={category.icon}
            />
          </svg>
        </div>
        <svg
          className="w-4 h-4 text-secondary"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2Z" />
        </svg>
      </div>

      <div>
        <h3 className="font-bold text-base text-primary">{item.title}</h3>
        <p className="text-[10px] uppercase tracking-widest mt-1 text-on-surface-variant">
          Updated {formatDate(item.updatedAt)}
        </p>
      </div>
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
