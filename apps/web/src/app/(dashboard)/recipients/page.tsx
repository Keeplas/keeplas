"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Loader, Button, Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { RecipientGroupCard } from "./recipient-group-card";
import { CreateGroupDialog } from "./create-group-dialog";

export default function RecipientsPage() {
  const groups = useQuery(api.recipient_groups.listGroups);
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const [showCreate, setShowCreate] = useState(false);

  if (groups === undefined || contacts === undefined) {
    return <Loader size="md" />;
  }

  const totalRecipients = contacts.filter(
    (c) => c.invitationStatus === "accepted"
  ).length;

  return (
    <div className="max-w-screen-2xl mx-auto">
      <header className="mb-10 max-w-3xl">
        <h1 className="text-headline-lg text-primary mb-4">
          Recipients &<br />
          <span className="text-secondary">Release Groups</span>
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          Define who receives which vault items at trigger. Group recipients by
          context — Family, Legal, Business — and assign them per item without
          giving everyone access to everything.
        </p>
      </header>

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
              onClick={() => setShowCreate(true)}
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
              groups defined · {totalRecipients} reachable contacts
            </p>
          </section>
        </aside>

        <div className="lg:col-span-8 space-y-6">
          {groups.length === 0 ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowCreate(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setShowCreate(true);
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
                onClick={() => setShowCreate(true)}
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

      <CreateGroupDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        contacts={contacts}
      />
    </div>
  );
}
