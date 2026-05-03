"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  HelpHint,
  Icon,
  Loader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { ContactCard } from "./contact-card";
import { InviteContactDialog } from "./invite-contact-dialog";
import { AccessRequestsSection } from "./access-requests-section";
import { RecipientGroupCard } from "./recipient-group-card";
import { CreateGroupDialog } from "./create-group-dialog";
import { useBackfillVerificationEnvelopes } from "./use-backfill-verification-envelopes";

const MAX_TRUST_CONTACTS = 5;

const GUARDIAN_ROLES = [
  {
    icon: "M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z",
    title: "Recovery Partner",
    description: "Empowered to initiate account recovery and verify identity in case of lost access.",
  },
  {
    icon: "M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75",
    title: "Medical Proxy",
    description: "Grants instant access to health directives and medical history during emergencies.",
  },
  {
    icon: "M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Z",
    title: "Legal Legacy",
    description: "Notified to manage digital assets and final wishes according to your protocol.",
  },
];

export default function TrustedContactsPage() {
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const groups = useQuery(api.recipient_groups.listGroups);
  useBackfillVerificationEnvelopes(contacts);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteType, setInviteType] = useState<"trust" | "recipient_only">(
    "trust"
  );
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  function openInvite(type: "trust" | "recipient_only") {
    setInviteType(type);
    setShowInviteDialog(true);
  }

  if (contacts === undefined || groups === undefined) {
    return <Loader size="md" />;
  }

  const activeContacts = contacts.filter(
    (c) => c.invitationStatus !== "revoked"
  );
  const trustContacts = activeContacts.filter(
    (c) => (c.contactType ?? "trust") === "trust"
  );
  const recipientContacts = activeContacts.filter(
    (c) => c.contactType === "recipient_only"
  );
  const canInviteTrust = trustContacts.length < MAX_TRUST_CONTACTS;
  const hasFirstResponder = trustContacts.some((c) => c.isFirstResponder);
  const modeAContacts = trustContacts.filter((c) =>
    c.accessModes.includes("mode_a")
  );
  const trustPct = Math.min(
    100,
    Math.round((trustContacts.length / MAX_TRUST_CONTACTS) * 100)
  );
  const reachableContacts = activeContacts.filter(
    (c) => c.invitationStatus === "accepted"
  ).length;

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
                        <svg className="w-5 h-5 text-secondary-fixed" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={role.icon} />
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

              <section className="relative overflow-hidden rounded-2xl vault-gradient p-6 text-on-primary shadow-xl">
                <h3 className="text-headline-sm mb-2">Secure Invitation</h3>
                <p className="text-body-md opacity-80 mb-5">
                  Each contact must verify their identity and accept their role via encrypted invitation.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => openInvite("trust")}
                    className="w-full py-3 bg-secondary text-on-secondary font-bold text-body-md rounded-xl hover:bg-on-secondary-container transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                    </svg>
                    Add New Guardian
                  </button>
                  <button
                    onClick={() => openInvite("recipient_only")}
                    className="w-full py-3 bg-on-primary/10 hover:bg-on-primary/20 text-on-primary font-medium text-body-md rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-on-primary/20"
                  >
                    <Icon path={ICON_PATHS.userPlus} className="w-4 h-4" strokeWidth={2} />
                    Add Recipient Only
                  </button>
                </div>
              </section>

              <section className="bg-primary-container p-6 rounded-2xl text-on-primary-container relative overflow-hidden min-h-[150px] flex flex-col justify-end">
                <svg
                  className="absolute top-3 right-3 w-16 h-16 opacity-10 text-on-primary"
                  fill="currentColor" viewBox="0 0 24 24"
                >
                  <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Z" />
                </svg>
                <p className="text-headline-md font-black mb-1.5 text-on-primary">
                  {trustContacts.length} / {MAX_TRUST_CONTACTS}
                </p>
                <p className="text-label-md text-on-primary-container">
                  Network Strength: {trustContacts.length >= 3 ? "Stable" : trustContacts.length >= 1 ? "Developing" : "Unprotected"}
                </p>
                <div className="mt-3 h-1.5 w-full bg-primary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary-fixed rounded-full transition-all"
                    style={{ width: `${trustPct}%` }}
                  />
                </div>
              </section>
            </aside>

            <div className="lg:col-span-8 space-y-6">
              {activeContacts.length > 0 && !hasFirstResponder && (
                <div className="p-4 bg-secondary-fixed/20 rounded-xl border-l-4 border-secondary">
                  <p className="text-body-md text-on-surface font-medium">
                    No First Responder designated. Assign one contact as your First
                    Responder for Life Check escalation.
                  </p>
                </div>
              )}
              {modeAContacts.length === 1 && (
                <div className="p-4 bg-error-container/30 rounded-xl border-l-4 border-error">
                  <p className="text-body-md text-on-surface font-medium">
                    Post-mortem access requires at least 2 contacts. Only{" "}
                    {modeAContacts[0].name} is currently assigned.
                  </p>
                </div>
              )}

              {activeContacts.length === 0 ? (
                <div className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-12 rounded-2xl hover:bg-surface-container-low transition-colors cursor-pointer group"
                  onClick={() => openInvite("trust")}
                >
                  <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <h3 className="text-headline-sm text-primary">
                    Invite Your First Guardian
                  </h3>
                  <p className="text-body-md text-on-surface-variant mt-2 text-center max-w-xs">
                    Up to {MAX_TRUST_CONTACTS} trusted guardians can receive recovery fragments. Recipient-only contacts have no cap.
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
                        <ContactCard key={contact._id} contact={contact} />
                      ))}
                      {canInviteTrust && (
                        <button
                          onClick={() => openInvite("trust")}
                          className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-8 rounded-2xl hover:bg-surface-container-low transition-colors cursor-pointer group"
                        >
                          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                          </div>
                          <p className="text-headline-sm text-primary">
                            Invite Next Trust Contact
                          </p>
                          <p className="text-label-md text-on-surface-variant mt-1">
                            {MAX_TRUST_CONTACTS - trustContacts.length} slots remaining
                          </p>
                        </button>
                      )}
                    </div>
                  </section>

                  {(recipientContacts.length > 0 || trustContacts.length >= MAX_TRUST_CONTACTS) && (
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
                            People who only receive items at trigger — no recovery role, no shard, no cap.
                          </p>
                        </button>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {recipientContacts.map((contact) => (
                            <ContactCard key={contact._id} contact={contact} />
                          ))}
                          <button
                            onClick={() => openInvite("recipient_only")}
                            className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-8 rounded-2xl hover:bg-surface-container-low transition-colors cursor-pointer group"
                          >
                            <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                              <svg className="w-6 h-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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
                    <span>Add trust contacts and recipient-only people to groups</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-secondary/15 text-secondary flex items-center justify-center text-label-md font-bold shrink-0">
                      3
                    </span>
                    <span>Pick groups when sealing items in the vault</span>
                  </li>
                </ul>
              </section>

              <section className="relative overflow-hidden rounded-2xl vault-gradient p-6 text-on-primary shadow-xl">
                <h3 className="text-headline-sm mb-2">New release group</h3>
                <p className="text-body-md opacity-80 mb-5">
                  Group recipients by purpose. Assign a default group so most items
                  flow there automatically.
                </p>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setShowCreateGroup(true)}
                  className="w-full gap-2 cursor-pointer"
                >
                  <Icon path={ICON_PATHS.plus} className="w-4 h-4" strokeWidth={2} />
                  Create Group
                </Button>
              </section>

              <section className="bg-primary-container p-6 rounded-2xl text-on-primary-container relative overflow-hidden min-h-[150px] flex flex-col justify-end">
                <p className="text-headline-md font-black mb-1.5 text-on-primary">
                  {groups.length}
                </p>
                <p className="text-label-md text-on-primary-container">
                  groups defined · {reachableContacts} reachable contacts
                </p>
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
                    Create your first group to start routing vault items to specific
                    recipients at trigger time.
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
                    <p className="text-headline-sm text-primary">
                      New Group
                    </p>
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
    </div>
  );
}
