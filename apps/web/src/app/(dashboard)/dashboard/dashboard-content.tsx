"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@keeplas/backend/_generated/api";
import { Spinner } from "@keeplas/ui";
import { getCategoryConfig } from "@/lib/vault-categories";

export function DashboardContent() {
  const user = useQuery(api.users.viewer);
  const data = useQuery(api.dashboard.getDashboardData);

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (data === null) return null;

  const score = data.integrityScore;
  const circumference = 2 * Math.PI * 88;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-primary tracking-tight leading-none mb-1">
            Welcome back{user?.name ? `, ${user.name}` : ""}.
          </h1>
          <p className="text-on-surface-variant font-body">
            Your legacy is protected and synchronized.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-xl">
          <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <span className="font-label text-[11px] font-bold uppercase tracking-widest text-primary">
            Vault Encrypted
          </span>
        </div>
      </div>

      {/* Protection Banner */}
      {data.confirmedContacts === 0 && (
        <div className="bg-primary-container text-on-primary-container p-6 rounded-2xl mb-8 flex items-start gap-4">
          <svg className="w-6 h-6 text-secondary-fixed shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div className="flex-1">
            <h3 className="font-headline font-bold text-surface-container-lowest mb-1">
              Vault not protected in emergency
            </h3>
            <p className="text-sm text-on-primary-container leading-relaxed">
              Without a trusted contact, no one can access your vault if something happens to you.
            </p>
          </div>
          <Link
            href="/trusted-contacts"
            className="shrink-0 px-4 py-2 bg-secondary-fixed text-on-secondary-fixed-variant rounded-xl font-label font-bold text-sm cursor-pointer"
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
          <div className="bg-surface-container-low rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden">
            <div className="relative w-44 h-44 flex items-center justify-center mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 192 192">
                <circle
                  cx="96" cy="96" r="88"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-surface-container-highest"
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
            <h3 className="font-headline font-bold text-lg text-primary">Vault Integrity</h3>
            <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
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
                    className="flex items-center justify-between p-4 bg-surface-container-low hover:bg-surface-container-high transition-colors rounded-xl group cursor-pointer"
                  >
                    <span className="font-headline font-bold text-sm text-primary">
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

        {/* Right: Recent Items + Category Summary */}
        <div className="lg:col-span-8 space-y-6">
          {/* Recent Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">
                Recent Items
              </h4>
              {data.totalItems > 0 && (
                <Link href="/vault" className="text-sm text-secondary font-bold cursor-pointer">
                  View all
                </Link>
              )}
            </div>
            {data.recentItems.length === 0 ? (
              <div className="bg-surface-container-low rounded-2xl p-8 text-center">
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
              <div className="space-y-2">
                {data.recentItems.map((item) => {
                  const cat = getCategoryConfig(item.category);
                  return (
                    <Link
                      key={item._id}
                      href={`/vault/${item._id}`}
                      className={`flex items-center gap-4 p-4 rounded-xl transition-colors cursor-pointer ${
                        item.isCritical
                          ? "bg-primary-container hover:bg-primary-container/80"
                          : "bg-surface-container-low hover:bg-surface-container-high"
                      }`}
                    >
                      <svg
                        className={`w-5 h-5 shrink-0 ${item.isCritical ? "text-secondary-fixed" : "text-secondary"}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className={`font-headline font-bold text-sm truncate ${item.isCritical ? "text-surface-container-lowest" : "text-primary"}`}>
                          {item.title}
                        </p>
                        <p className={`text-[11px] ${item.isCritical ? "text-on-primary-container/60" : "text-on-surface-variant"}`}>
                          {cat.label}
                        </p>
                      </div>
                      {item.isCritical && (
                        <span className="text-[10px] font-label font-bold uppercase tracking-widest text-secondary-fixed">
                          Critical
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Category Summary */}
          <div>
            <h4 className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 px-1">
              Categories
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: "personal_document", label: "Documents" },
                { key: "financial_asset", label: "Financial" },
                { key: "digital_asset", label: "Digital" },
                { key: "health_directive", label: "Health" },
                { key: "legal_document", label: "Legal" },
                { key: "credential", label: "Credentials" },
              ].map((cat) => {
                const count = (data.categoryCounts as Record<string, number>)[cat.key] ?? 0;
                return (
                  <Link
                    key={cat.key}
                    href="/vault"
                    className="p-4 bg-surface-container-low hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer"
                  >
                    <p className="text-2xl font-headline font-black text-primary">{count}</p>
                    <p className="text-[11px] font-label font-bold uppercase tracking-widest text-on-surface-variant">
                      {cat.label}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
