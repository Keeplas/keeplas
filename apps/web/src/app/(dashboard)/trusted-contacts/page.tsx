"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import {
  HelpHint,
  Icon,
  InfoCallout,
  Loader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { ContactCard } from "./contact-card";
import { ContactDetailSheet } from "./contact-detail-sheet";
import { InviteContactDialog } from "./invite-contact-dialog";
import { AccessRequestsSection } from "./access-requests-section";
import { DistributeShardsSection } from "./distribute-shards-section";
import { RecipientGroupCard } from "./recipient-group-card";
import { CreateGroupDialog } from "./create-group-dialog";
import { useBackfillVerificationEnvelopes } from "./use-backfill-verification-envelopes";
import { MIN_TRUST_CONTACTS_FOR_RECOVERY } from "@/lib/use-distribute-shards";

const MAX_TRUST_CONTACTS = 5;

const GUARDIAN_ROLES = [
  {
    icon: "M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z",
    title: "Holds a recovery shard",
    description:
      "Each trust contact stores one encrypted fragment of your master key. Two of them confirming, then submitting their shards, is what unlocks the vault.",
  },
  {
    icon: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
    title: "Confirms you are unreachable",
    description:
      "After Life Check has exhausted every channel, your trust contacts are notified. Two of them must confirm you are unreachable to open the 72-hour grace window.",
  },
  {
    icon: "M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z",
    title: "Releases vault & recipients",
    description:
      "Once the grace window passes without your reply, shard submissions reach quorum and the vault unlocks. Recipients then receive their pre-assigned items.",
  },
];

export default function TrustedContactsPage() {
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const groups = useQuery(api.recipient_groups.listGroups);
  const me = useQuery(api.onboarding.getOnboardingState);
  useBackfillVerificationEnvelopes(contacts);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteType, setInviteType] = useState<"trust" | "recipient_only">(
    "trust",
  );
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [selectedContact, setSelectedContact] =
    useState<Doc<"trusted_contacts"> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function openInvite(type: "trust" | "recipient_only") {
    setInviteType(type);
    setShowInviteDialog(true);
  }

  function openContact(contact: Doc<"trusted_contacts">) {
    setSelectedContact(contact);
    setSheetOpen(true);
  }

  if (contacts === undefined || groups === undefined) {
    return <Loader size="md" />;
  }

  const activeContacts = contacts.filter(
    (c) => c.invitationStatus !== "revoked",
  );
  const trustContacts = activeContacts.filter(
    (c) => (c.contactType ?? "trust") === "trust",
  );
  const recipientContacts = activeContacts.filter(
    (c) => c.contactType === "recipient_only",
  );
  const canInviteTrust = trustContacts.length < MAX_TRUST_CONTACTS;
  const acceptedTrustContacts = trustContacts.filter(
    (c) => c.invitationStatus === "accepted",
  );
  const pendingTrustCount = trustContacts.filter(
    (c) => c.invitationStatus === "pending",
  ).length;
  const shardsConfirmedCount = acceptedTrustContacts.filter(
    (c) => c.shardConfirmed,
  ).length;
  const threshold = me?.vaultThreshold ?? 2;
  const acceptedCount = acceptedTrustContacts.length;
  const quorumPct = Math.min(
    100,
    (Math.min(acceptedCount, threshold) / MAX_TRUST_CONTACTS) * 100,
  );
  const bufferPct = Math.max(
    0,
    ((acceptedCount - threshold) / MAX_TRUST_CONTACTS) * 100,
  );
  const networkState: "unprotected" | "atRisk" | "quorumMet" | "resilient" =
    acceptedCount === 0
      ? "unprotected"
      : acceptedCount < threshold
        ? "atRisk"
        : acceptedCount === threshold
          ? "quorumMet"
          : "resilient";

  return (
    <div className="max-w-screen-2xl mx-auto">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-headline-lg text-primary mb-4">
          Trusted Circle &<br />
          <span className="text-secondary">Release Routing</span>
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          Designate the people who protect your legacy and decide who receives
          which vault items at trigger. Manage guardians and recipient-only
          contacts here, then bundle them into release groups.
        </p>
        <Link
          href="/docs/trusted-contacts"
          className="inline-flex items-center gap-2 text-secondary font-bold text-body-md hover:underline mt-3"
        >
          How trust contacts work
          <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        </Link>
        <InfoCallout
          icon={ICON_PATHS.medicalInformation}
          tone="info"
          className="mt-6"
        >
          For acute emergencies (accident, sudden illness), set up your
          phone&rsquo;s built-in Medical ID — paramedics check it first.{" "}
          <Link
            href="/docs/emergency-info"
            className="font-bold text-secondary hover:underline"
          >
            Learn how →
          </Link>
        </InfoCallout>
      </header>

      <Tabs defaultValue="contacts" className="space-y-8">
        <TabsList>
          <TabsTrigger value="contacts">
            Contacts
            <span className="text-label-md opacity-70">
              ({activeContacts.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="groups">
            Release Groups
            <span className="text-label-md opacity-70">({groups.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4 space-y-6">
              <section className="bg-surface-container-low p-6 rounded-2xl">
                <h3 className="text-headline-sm text-primary mb-5">
                  The Role of Guardians
                </h3>
                <div className="space-y-6">
                  {GUARDIAN_ROLES.map((role) => (
                    <div key={role.title} className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center shrink-0">
                        <svg
                          className="w-5 h-5 text-secondary-fixed"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={role.icon}
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-label-md text-primary mb-1">
                          {role.title}
                        </p>
                        <p className="text-body-md text-on-surface-variant">
                          {role.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-primary-container p-6 rounded-2xl text-on-primary-container relative overflow-hidden">
                <svg
                  className="absolute top-3 right-3 w-16 h-16 opacity-10 text-on-primary"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Z" />
                </svg>

                <p className="text-label-md uppercase tracking-wider text-on-primary-container/70 mb-2 inline-flex items-center gap-1.5">
                  Recovery Network
                  <HelpHint
                    content={`Tracks whether your social recovery is operational. The big number is how many guardians have accepted out of the ${threshold} needed to unlock the vault (your quorum, set during onboarding). Below quorum, recovery is impossible. At quorum, it works but a single missing guardian breaks it. Above quorum, you have buffer. Pending invites and shard distribution are shown so you know exactly what's left to do.`}
                  />
                </p>

                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[2.75rem] font-bold leading-none text-on-primary">
                    {acceptedCount}
                  </span>
                  <span className="text-headline-sm text-on-primary-container/70">
                    / {threshold}
                  </span>
                  <span className="text-label-md text-on-primary-container/60 ml-1">
                    quorum
                  </span>
                </div>

                <p className="text-label-md text-on-primary-container/60 mb-3">
                  Step 2 · Shamir shards needed to unlock the vault
                </p>

                <p className="text-label-md font-bold text-on-primary mb-4">
                  {networkState === "unprotected" &&
                    "Unprotected — invite your first guardian"}
                  {networkState === "atRisk" &&
                    `At risk — ${threshold - acceptedCount} more to reach quorum`}
                  {networkState === "quorumMet" &&
                    "Quorum met — add more for redundancy"}
                  {networkState === "resilient" &&
                    `Resilient — ${acceptedCount - threshold} guardian${
                      acceptedCount - threshold === 1 ? "" : "s"
                    } of buffer`}
                </p>

                <div className="h-1.5 w-full bg-primary rounded-full overflow-hidden flex mb-4">
                  <div
                    className="h-full bg-secondary-fixed transition-all"
                    style={{ width: `${quorumPct}%` }}
                  />
                  <div
                    className="h-full bg-secondary-fixed/30 transition-all"
                    style={{ width: `${bufferPct}%` }}
                  />
                </div>

                <ul className="space-y-1 text-label-md text-on-primary-container/80">
                  <li className="flex justify-between">
                    <span>Accepted</span>
                    <span className="font-bold text-on-primary">
                      {acceptedCount}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Pending invites</span>
                    <span className="font-bold text-on-primary">
                      {pendingTrustCount}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Shards distributed</span>
                    <span className="font-bold text-on-primary">
                      {shardsConfirmedCount} / {acceptedCount}
                    </span>
                  </li>
                  <li className="flex justify-between pt-1 border-t border-on-primary/10 mt-1">
                    <span className="text-on-primary-container/60">
                      Max guardians
                    </span>
                    <span className="text-on-primary-container/60">
                      {MAX_TRUST_CONTACTS}
                    </span>
                  </li>
                </ul>
              </section>
            </aside>

            <div className="lg:col-span-8 space-y-6">
              {acceptedCount > 0 &&
                acceptedCount < MIN_TRUST_CONTACTS_FOR_RECOVERY && (
                  <div className="p-4 bg-error-container/30 rounded-xl">
                    <p className="text-label-md uppercase tracking-wider text-error mb-1">
                      One guardian is not enough
                    </p>
                    <p className="text-body-md text-on-surface font-medium">
                      Only {acceptedTrustContacts[0].name} is accepted so far —
                      invite at least one more. Recovery cannot work with a
                      single guardian for two reasons: at least 2 trust contacts
                      must vote that you are unreachable before the grace window
                      opens, and a lone guardian has no peer to exchange shards
                      with, so the vault can never reach the 2 shards needed to
                      reconstruct your key.
                    </p>
                  </div>
                )}

              <DistributeShardsSection />

              {activeContacts.length === 0 ? (
                <div
                  className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-12 rounded-2xl hover:bg-surface-container-low transition-colors cursor-pointer group"
                  onClick={() => openInvite("trust")}
                >
                  <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <svg
                      className="w-8 h-8 text-secondary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                  </div>
                  <h3 className="text-headline-sm text-primary">
                    Invite Your First Guardian
                  </h3>
                  <p className="text-body-md text-on-surface-variant mt-2 text-center max-w-xs">
                    Up to {MAX_TRUST_CONTACTS} trusted guardians can receive
                    recovery fragments. Recipient-only contacts have no cap.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-headline-sm text-primary flex items-center gap-1.5">
                        Trust Contacts
                        <span className="text-label-md text-on-surface-variant ml-2">
                          ({trustContacts.length}/{MAX_TRUST_CONTACTS})
                        </span>
                        <HelpHint content="Trust contacts each hold one encrypted shard of your recovery key. They can collectively help you regain vault access. Capped at 5 by design — fewer is fine, more would weaken the security model." />
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {trustContacts.map((contact) => (
                        <ContactCard
                          key={contact._id}
                          contact={contact}
                          onSelect={openContact}
                        />
                      ))}
                      {canInviteTrust && (
                        <button
                          onClick={() => openInvite("trust")}
                          className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-8 rounded-2xl hover:bg-surface-container-low transition-colors cursor-pointer group"
                        >
                          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <svg
                              className="w-6 h-6 text-secondary"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 4.5v15m7.5-7.5h-15"
                              />
                            </svg>
                          </div>
                          <p className="text-headline-sm text-primary">
                            Invite Next Trust Contact
                          </p>
                          <p className="text-label-md text-on-surface-variant mt-1">
                            {MAX_TRUST_CONTACTS - trustContacts.length} slots
                            remaining
                          </p>
                        </button>
                      )}
                    </div>
                  </section>

                  {(recipientContacts.length > 0 ||
                    trustContacts.length >= MAX_TRUST_CONTACTS) && (
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-headline-sm text-primary flex items-center gap-1.5">
                          Recipients Only
                          <span className="text-label-md text-on-surface-variant ml-2">
                            ({recipientContacts.length})
                          </span>
                          <HelpHint content="People who only receive items when a trigger fires (conditional message, vault release). They don't hold a recovery shard, so there's no cap on how many you can add." />
                        </h2>
                      </div>
                      {recipientContacts.length === 0 ? (
                        <button
                          onClick={() => openInvite("recipient_only")}
                          className="w-full border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-8 rounded-2xl hover:bg-surface-container-low transition-colors cursor-pointer group"
                        >
                          <p className="text-headline-sm text-primary">
                            Add a Recipient
                          </p>
                          <p className="text-label-md text-on-surface-variant mt-1 text-center max-w-md">
                            People who only receive items at trigger — no
                            recovery role, no shard, no cap.
                          </p>
                        </button>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {recipientContacts.map((contact) => (
                            <ContactCard
                              key={contact._id}
                              contact={contact}
                              onSelect={openContact}
                            />
                          ))}
                          <button
                            onClick={() => openInvite("recipient_only")}
                            className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-8 rounded-2xl hover:bg-surface-container-low transition-colors cursor-pointer group"
                          >
                            <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                              <svg
                                className="w-6 h-6 text-secondary"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 4.5v15m7.5-7.5h-15"
                                />
                              </svg>
                            </div>
                            <p className="text-headline-sm text-primary">
                              Add Recipient
                            </p>
                          </button>
                        </div>
                      )}
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-12">
            <AccessRequestsSection />
          </div>
        </TabsContent>

        <TabsContent value="groups">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4 space-y-6">
              <section className="bg-surface-container-low p-6 rounded-2xl">
                <h3 className="text-headline-sm text-primary mb-3">
                  How groups work
                </h3>
                <p className="text-body-md text-on-surface-variant mb-4">
                  When you add a vault item, you can pick one or more groups. At
                  trigger, only the contacts in those groups receive that item.
                  Items with no group default to all trust contacts.
                </p>
                <ul className="space-y-3 text-body-md text-on-surface-variant">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-secondary/15 text-secondary flex items-center justify-center text-label-md font-bold shrink-0">
                      1
                    </span>
                    <span>Create groups by context (Family, Legal…)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-secondary/15 text-secondary flex items-center justify-center text-label-md font-bold shrink-0">
                      2
                    </span>
                    <span>
                      Add trust contacts and recipient-only people to groups
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-secondary/15 text-secondary flex items-center justify-center text-label-md font-bold shrink-0">
                      3
                    </span>
                    <span>Pick groups when sealing items in the vault</span>
                  </li>
                </ul>
              </section>
            </aside>
            <div className="lg:col-span-8 space-y-6">
              {groups.length === 0 ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowCreateGroup(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowCreateGroup(true);
                    }
                  }}
                  className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-12 rounded-2xl hover:bg-surface-container-low transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
                >
                  <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon
                      path={ICON_PATHS.userPlus}
                      className="w-8 h-8 text-secondary"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="text-headline-sm text-primary">
                    No groups yet
                  </h3>
                  <p className="text-body-md text-on-surface-variant mt-2 text-center max-w-xs">
                    Create your first group to start routing vault items to
                    specific recipients at trigger time.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {groups.map((group) => (
                    <RecipientGroupCard
                      key={group._id}
                      group={group}
                      contacts={contacts}
                    />
                  ))}
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-8 rounded-2xl hover:bg-surface-container-low transition-colors cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Icon
                        path={ICON_PATHS.plus}
                        className="w-6 h-6 text-secondary"
                        strokeWidth={1.5}
                      />
                    </div>
                    <p className="text-headline-sm text-primary">New Group</p>
                    <p className="text-label-md text-on-surface-variant mt-1">
                      Add another release context
                    </p>
                  </button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <InviteContactDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        initialContactType={inviteType}
      />
      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        contacts={contacts}
      />
      <ContactDetailSheet
        contact={selectedContact}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
