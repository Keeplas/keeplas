"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@keeplas/backend/_generated/api";
import { Loader } from "@keeplas/ui";
import { getCategoryConfig } from "@/lib/vault-categories";

const ACTION_ICONS: Record<string, string> = {
  add_item:
    "M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M12 15h.008v.008H12V15Zm-3.375-7.5V5.625C8.625 4.175 9.8 3 11.25 3h1.5c1.45 0 2.625 1.175 2.625 2.625V7.5",
  invite_contact:
    "M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z",
  emergency_card:
    "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z",
  life_check:
    "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z",
  more_categories:
    "M12 4.5v15m7.5-7.5h-15",
};

const CATEGORY_CARDS = [
  {
    key: "personal_document",
    label: "Personal Records",
    icon: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  },
  {
    key: "financial_asset",
    label: "Financial Assets",
    icon: "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3",
  },
  {
    key: "business_continuity",
    label: "Business Continuity",
    icon: "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h3.75m-3.75 3h3.75m-3.75 3h3.75M3 21h18",
    highlight: true,
  },
  {
    key: "digital_asset",
    label: "Digital Assets",
    icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125",
  },
];

export function DashboardContent() {
  const user = useQuery(api.users.viewer);
  const data = useQuery(api.dashboard.getDashboardData);

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader />
      </div>
    );
  }

  if (data === null) return null;

  const score = data.integrityScore;
  const circumference = 2 * Math.PI * 88;
  const offset = circumference - (score / 100) * circumference;

  const firstName = user?.name?.split(" ")[0] ?? "Curator";

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
        <div>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl text-primary tracking-tight leading-none mb-2">
            Welcome back, {firstName}.
          </h1>
          <p className="text-on-surface-variant font-body text-sm md:text-base max-w-xl">
            Your legacy is protected and synchronized across all secure nodes.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-full self-start md:self-end">
          <svg className="w-4 h-4 text-secondary" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Zm-1 16-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7Z" />
          </svg>
          <span className="font-label text-[11px] font-bold uppercase tracking-widest text-primary">
            Vault Encrypted & Secured
          </span>
        </div>
      </header>

      {/* Protection Banner */}
      {data.confirmedContacts === 0 && (
        <div className="bg-primary-container text-on-primary-container p-6 rounded-2xl mb-10 flex items-start gap-4">
          <svg className="w-6 h-6 text-secondary-fixed shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div className="flex-1">
            <h3 className="font-headline font-bold text-on-primary mb-1">
              Vault not protected in emergency
            </h3>
            <p className="text-sm text-on-primary-container leading-relaxed">
              Without a trusted contact, no one can access your vault if something happens to you.
            </p>
          </div>
          <Link
            href="/trusted-contacts"
            className="shrink-0 px-4 py-2 bg-secondary-fixed text-on-secondary-fixed-variant rounded-xl font-label font-bold text-xs uppercase tracking-widest cursor-pointer"
          >
            Invite now
          </Link>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Score + Actions */}
        <div className="lg:col-span-4 space-y-6">
          {/* Score Widget */}
          <div className="bg-surface-container rounded-full p-8 flex flex-col items-center justify-center text-center aspect-square relative overflow-hidden shadow-sm">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at center, color-mix(in srgb, var(--color-secondary) 6%, transparent), transparent 70%)",
              }}
            />
            <div className="relative w-36 h-36 flex items-center justify-center mb-3">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 192 192">
                <circle
                  cx="96" cy="96" r="88"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-surface-variant"
                />
                <circle
                  cx="96" cy="96" r="88"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="text-secondary transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-headline font-black text-primary">{score}%</span>
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
                  Complete
                </span>
              </div>
            </div>
            <h3 className="font-headline font-bold text-base text-primary">Vault Integrity</h3>
            <p className="text-sm text-on-surface-variant mt-2 leading-relaxed max-w-[220px]">
              {data.nudgeMessage}
            </p>
          </div>

          {/* Priority Actions */}
          {data.priorityActions.length > 0 && (
            <div>
              <h4 className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 px-1">
                Priority Actions
              </h4>
              <div className="space-y-2">
                {data.priorityActions.map((action) => (
                  <Link
                    key={action.key}
                    href={action.href}
                    className="flex items-center justify-between p-4 bg-surface-container-low hover:bg-surface-container transition-colors rounded-xl group cursor-pointer"
                  >
                    <span className="flex items-center gap-3 font-headline font-bold text-sm text-primary">
                      <span className="w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center shadow-sm">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={ACTION_ICONS[action.key] ?? ACTION_ICONS.add_item}
                          />
                        </svg>
                      </span>
                      {action.label}
                    </span>
                    <svg
                      className="w-5 h-5 text-outline-variant group-hover:translate-x-1 transition-transform"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Categories + Recent Activity */}
        <div className="lg:col-span-8 space-y-8">
          {/* Category Bento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CATEGORY_CARDS.map((cat) => {
              const count = (data.categoryCounts as Record<string, number>)[cat.key] ?? 0;
              const isIncomplete = cat.highlight && count === 0;
              return (
                <Link
                  key={cat.key}
                  href="/vault"
                  className={
                    isIncomplete
                      ? "bg-primary-container p-6 rounded-full flex flex-col justify-between min-h-[180px] relative overflow-hidden group"
                      : "bg-surface-container-low p-6 rounded-full flex flex-col justify-between min-h-[180px] hover:bg-surface-container transition-all group"
                  }
                >
                  <div className="flex items-start justify-between">
                    <svg
                      className={`w-6 h-6 ${isIncomplete ? "text-on-primary" : "text-primary"}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                    </svg>
                    <span
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full ${
                        isIncomplete
                          ? "bg-secondary text-on-secondary"
                          : "bg-secondary-container text-on-secondary-container"
                      }`}
                    >
                      {isIncomplete ? "Incomplete" : `${count} ${count === 1 ? "Item" : "Items"}`}
                    </span>
                  </div>
                  <div>
                    <p className={`text-lg font-headline font-extrabold ${isIncomplete ? "text-on-primary" : "text-primary"}`}>
                      {cat.label}
                    </p>
                    <p className={`text-[11px] mt-1 uppercase tracking-tight ${isIncomplete ? "text-on-primary-container" : "text-on-surface-variant"}`}>
                      {count === 0
                        ? "Critical: 0 Items Synced"
                        : `${count} ${count === 1 ? "item" : "items"} secured`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Recent Activity */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Recent Activity
              </h4>
              {data.totalItems > 0 && (
                <Link href="/vault" className="text-xs text-secondary font-bold cursor-pointer hover:underline">
                  View all
                </Link>
              )}
            </div>
            {data.recentItems.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-on-surface-variant mb-4">
                  No items in your vault yet.
                </p>
                <Link
                  href="/vault"
                  className="inline-flex vault-gradient text-on-primary font-headline font-bold py-2.5 px-5 rounded-xl text-sm cursor-pointer"
                >
                  Add your first item
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {data.recentItems.map((item) => {
                  const cat = getCategoryConfig(item.category);
                  return (
                    <Link
                      key={item._id}
                      href={`/vault/${item._id}`}
                      className="flex items-center gap-4 group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center shrink-0">
                        <svg
                          className="w-4 h-4 text-secondary"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-primary truncate">
                          {item.title}
                        </p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                          {cat.label} · {formatTimeAgo(item.updatedAt)}
                        </p>
                      </div>
                      {item.isCritical && (
                        <span className="text-[10px] font-label font-bold uppercase tracking-widest text-secondary">
                          Critical
                        </span>
                      )}
                      <svg
                        className="w-4 h-4 text-outline-variant group-hover:text-secondary transition-colors"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
