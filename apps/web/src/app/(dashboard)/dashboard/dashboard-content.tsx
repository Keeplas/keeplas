"use client";

import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

export function DashboardContent() {
  const user = useQuery(api.users.viewer);

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-bold tracking-tight text-primary">
          Welcome{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="mt-2 text-on-surface-variant">
          Your life continuity dashboard. Start building your vault.
        </p>
      </div>

      {/* Vault Integrity Score placeholder */}
      <div className="rounded-full bg-surface-container-low p-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline text-xl font-semibold">Vault Integrity</h2>
          <span className="text-3xl font-bold text-primary">0%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-surface-container-highest">
          <div className="h-full rounded-full gradient-signature" style={{ width: "0%" }} />
        </div>
        <p className="mt-3 text-sm text-on-surface-variant">
          Your vault is empty. Start by adding a document.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-full bg-surface-container-low p-6 hover:bg-surface-container transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-on-secondary-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h3 className="font-headline font-semibold mb-1">Add to Vault</h3>
          <p className="text-sm text-on-surface-variant">Store your first document securely</p>
        </div>

        <div className="rounded-full bg-surface-container-low p-6 hover:bg-surface-container transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-on-secondary-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </div>
          <h3 className="font-headline font-semibold mb-1">Invite Contact</h3>
          <p className="text-sm text-on-surface-variant">Add a trusted person to your network</p>
        </div>

        <div className="rounded-full bg-surface-container-low p-6 hover:bg-surface-container transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-on-secondary-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
            </svg>
          </div>
          <h3 className="font-headline font-semibold mb-1">Emergency Card</h3>
          <p className="text-sm text-on-surface-variant">Create your public emergency ID</p>
        </div>

        <div className="rounded-full bg-primary-container p-6 hover:opacity-90 transition-opacity cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-on-primary-container/20 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-on-primary-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </div>
          <h3 className="font-headline font-semibold mb-1 text-on-primary-container">Life Check</h3>
          <p className="text-sm text-on-primary-container/80">Configure your dead man&apos;s switch</p>
        </div>
      </div>
    </div>
  );
}
