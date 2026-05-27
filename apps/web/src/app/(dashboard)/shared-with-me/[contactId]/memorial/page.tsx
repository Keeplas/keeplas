"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Loader, Icon } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { CATEGORIES } from "@/lib/vault-categories";
import { MemorialIntroductionCard } from "./memorial-introduction-card";

export default function MemorialVaultPage() {
  const params = useParams();
  const contactId = params.contactId as Id<"trusted_contacts">;
  const data = useQuery(api.memorial.getReleasedVaultForMe, { contactId });

  if (data === undefined) return <Loader size="md" />;

  if (data === null) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-12 rounded-2xl">
          <h3 className="text-headline-sm text-primary">No memorial access</h3>
          <p className="text-body-md text-on-surface-variant mt-2 text-center max-w-md">
            This vault has not been released to you, or you are not one of its
            recipients.
          </p>
          <Link
            href="/shared-with-me"
            className="text-body-md font-bold text-secondary hover:underline mt-4"
          >
            Back to Shared with me
          </Link>
        </div>
      </div>
    );
  }

  const { owner, items, introductions } = data;

  return (
    <div className="max-w-screen-xl mx-auto">
      <header className="mb-8 max-w-3xl">
        <Link
          href="/shared-with-me"
          className="text-label-md text-on-surface-variant hover:text-primary"
        >
          ← Shared with me
        </Link>
        <h1 className="text-headline-lg text-primary mt-3 mb-2">
          In memory of {owner.name}
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          Read-only access to the {items.length} item
          {items.length === 1 ? "" : "s"} {owner.name} left for you. Everything
          is decrypted on your device.
        </p>
      </header>

      {introductions.length > 0 && (
        <section className="mb-12 bg-surface-container-low rounded-3xl p-8 space-y-8 max-w-3xl">
          <div>
            <p className="text-label-md text-secondary mb-1">
              A message from {owner.name}
            </p>
            <div className="h-px bg-outline-variant/30" />
          </div>
          {introductions.map((intro) => (
            <MemorialIntroductionCard
              key={intro._id}
              contactId={contactId}
              intro={intro}
            />
          ))}
        </section>
      )}

      {items.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">
          No readable items were released to you.
        </p>
      ) : (
        <div className="space-y-10">
          {CATEGORIES.map((cat) => {
            const catItems = items.filter((i) => i.category === cat.key);
            if (catItems.length === 0) return null;
            return (
              <section key={cat.key}>
                <div className="flex items-center gap-2 mb-4">
                  <Icon path={cat.icon} className="w-5 h-5 text-secondary" />
                  <h2 className="text-headline-sm text-primary">{cat.label}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catItems.map((item) =>
                    item.readable ? (
                      <Link
                        key={item._id}
                        href={`/shared-with-me/${contactId}/memorial/${item._id}`}
                        className="bg-surface-container-low hover:bg-surface-container transition-colors p-5 rounded-2xl block"
                      >
                        <p className="text-headline-sm text-primary truncate">
                          {item.title}
                        </p>
                        <p className="text-label-md text-on-surface-variant mt-1">
                          {item.hasFiles ? "Includes attachments · " : ""}Read →
                        </p>
                      </Link>
                    ) : (
                      <div
                        key={item._id}
                        className="bg-surface-container-low/60 p-5 rounded-2xl opacity-60"
                      >
                        <p className="text-headline-sm text-primary truncate">
                          {item.title}
                        </p>
                        <p className="text-label-md text-on-surface-variant mt-1">
                          Unavailable (legacy format)
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
