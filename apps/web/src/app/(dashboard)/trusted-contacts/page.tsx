"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Spinner } from "@keeplas/ui";
import { ContactCard } from "./contact-card";
import { InviteContactDialog } from "./invite-contact-dialog";
import { AccessRequestsSection } from "./access-requests-section";

const MAX_CONTACTS = 5;

export default function TrustedContactsPage() {
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  if (contacts === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const activeContacts = contacts.filter(
    (c) => c.invitationStatus !== "revoked"
  );
  const canInvite = activeContacts.length < MAX_CONTACTS;
  const hasFirstResponder = activeContacts.some((c) => c.isFirstResponder);
  const modeAContacts = activeContacts.filter((c) =>
    c.accessModes.includes("mode_a")
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <section className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <span className="font-label text-secondary font-semibold uppercase tracking-[0.2em] text-xs mb-3 block">
            Recovery Network
          </span>
          <h1 className="font-headline text-primary text-4xl md:text-5xl font-extrabold tracking-tighter leading-tight">
            Trusted Contacts
          </h1>
          <p className="text-on-surface-variant text-lg max-w-md mt-4">
            Designate up to 5 people who can help recover your vault in an
            emergency. Each receives a recovery fragment.
          </p>
        </div>
        <button
          onClick={() => setShowInviteDialog(true)}
          disabled={!canInvite}
          className="vault-gradient text-on-primary font-headline font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
            />
          </svg>
          Invite Contact
        </button>
      </section>

      {/* Warnings */}
      {activeContacts.length > 0 && !hasFirstResponder && (
        <div className="mb-6 p-4 bg-warning-container/10 rounded-xl">
          <p className="text-sm text-on-surface font-medium">
            No First Responder designated. Assign one contact as your First
            Responder for Life Check escalation.
          </p>
        </div>
      )}

      {modeAContacts.length === 1 && (
        <div className="mb-6 p-4 bg-warning-container/10 rounded-xl">
          <p className="text-sm text-on-surface font-medium">
            Post-mortem access requires at least 2 contacts. Only{" "}
            {modeAContacts[0].name} is currently assigned.
          </p>
        </div>
      )}

      {/* Contact count */}
      <div className="mb-6 flex items-center gap-4">
        <span className="text-sm text-on-surface-variant font-label">
          {activeContacts.length} / {MAX_CONTACTS} contacts
        </span>
        <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full bg-secondary rounded-full transition-all"
            style={{
              width: `${(activeContacts.length / MAX_CONTACTS) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Contacts Grid */}
      {activeContacts.length === 0 ? (
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
              d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
            />
          </svg>
          <h3 className="font-headline font-bold text-lg text-primary mb-2">
            No trusted contacts yet
          </h3>
          <p className="text-sm text-on-surface-variant mb-6 max-w-sm mx-auto">
            Without trusted contacts, no one can access your vault in an
            emergency. Invite someone you trust to get started.
          </p>
          <button
            onClick={() => setShowInviteDialog(true)}
            className="vault-gradient text-on-primary font-headline font-bold py-3 px-6 rounded-xl cursor-pointer"
          >
            Invite your first contact
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {activeContacts.map((contact) => (
            <ContactCard key={contact._id} contact={contact as any} />
          ))}
        </div>
      )}

      {/* Access Requests */}
      <AccessRequestsSection />

      {/* Invite Dialog */}
      <InviteContactDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />
    </div>
  );
}
