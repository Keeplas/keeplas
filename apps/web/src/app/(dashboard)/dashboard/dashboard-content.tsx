"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@keeplas/backend/_generated/api";
import { buttonVariants, Icon, Loader } from "@keeplas/ui";
import { getCategoryConfig } from "@/lib/vault-categories";
import { ICON_PATHS } from "@/lib/icons";
import { formatTimeAgo } from "@/lib/format";

const ACTION_ICONS: Record<string, string> = {
  add_item: ICON_PATHS.archive,
  invite_contact: ICON_PATHS.userPlus,
  emergency_card: ICON_PATHS.emergencyCard,
  life_check: ICON_PATHS.heartbeat,
  more_categories: ICON_PATHS.plus,
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
    return <Loader />;
  }

  if (data === null) return null;

  const score = data.integrityScore;
  const circumference = 2 * Math.PI * 88;
  const offset = circumference - (score / 100) * circumference;

  const firstName = user?.name?.split(" ")[0] ?? "Curator";

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
        <div>
          <h1 className="text-headline-lg text-primary mb-2">
            Welcome back, {firstName}.
          </h1>
          <p className="text-on-surface-variant text-body-lg max-w-xl">
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
          <Icon
            path={ICON_PATHS.warning}
            className="w-6 h-6 text-secondary-fixed shrink-0 mt-0.5"
          />
          <div className="flex-1">
            <h3 className="text-headline-sm text-on-primary mb-1">
              Vault not protected in emergency
            </h3>
            <p className="text-body-md text-on-primary-container">
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
            <h3 className="text-headline-sm text-primary">Vault Integrity</h3>
            <p className="text-body-md text-on-surface-variant mt-2 max-w-[220px]">
              {data.nudgeMessage}
            </p>
          </div>

          {/* Priority Actions */}
          {data.priorityActions.length > 0 && (
            <div>
              <h4 className="text-label-md text-on-surface-variant mb-3 px-1">
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
                        <Icon
                          path={ACTION_ICONS[action.key] ?? ACTION_ICONS.add_item}
                          className="w-4 h-4 text-primary"
                        />
                      </span>
                      {action.label}
                    </span>
                    <Icon
                      path={ICON_PATHS.chevronRight}
                      className="w-5 h-5 text-outline-variant group-hover:translate-x-1 transition-transform"
                    />
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
                    <Icon
                      path={cat.icon}
                      className={`w-6 h-6 ${isIncomplete ? "text-on-primary" : "text-primary"}`}
                    />
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
                    <p className={`text-headline-sm ${isIncomplete ? "text-on-primary" : "text-primary"}`}>
                      {cat.label}
                    </p>
                    <p className={`text-label-md mt-1 ${isIncomplete ? "text-on-primary-container" : "text-on-surface-variant"}`}>
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
              <h4 className="text-label-md text-on-surface-variant">
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
                  className={buttonVariants({ variant: "vault", size: "sm" })}
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
                        <Icon path={cat.icon} className="w-4 h-4 text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-primary truncate">
                          {item.title}
                        </p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                          {cat.label} · {formatTimeAgo(item.updatedAt)}
                        </p>
                      </div>
                      <Icon
                        path={ICON_PATHS.chevronRight}
                        className="w-4 h-4 text-outline-variant group-hover:text-secondary transition-colors"
                      />
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

