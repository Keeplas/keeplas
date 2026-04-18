"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  ErrorAlert,
  Icon,
  Input,
  Label,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";

export default function TerminatePage() {
  const router = useRouter();
  const deleteAccount = useMutation(api.users.deleteAccount);
  const { signOut } = useAuthActions();
  const vault = useQuery(api.vaults.getVault);
  const items = useQuery(api.vault_items.getItems);

  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => `term-${Date.now().toString(36)}`);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmation !== "DELETE") {
      setError('Type DELETE exactly to confirm.');
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await deleteAccount({ confirmation });
      await signOut();
      router.push("/login");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to terminate plan."));
      setSubmitting(false);
    }
  }

  const itemCount = items?.length ?? 0;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl">
        <aside className="vault-gradient text-on-primary p-10 flex flex-col justify-between min-h-[500px]">
          <div>
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-on-primary/10 backdrop-blur">
              <Icon path={ICON_PATHS.warning} className="w-7 h-7" />
            </span>
            <h1 className="font-headline text-3xl md:text-4xl font-extrabold mt-6 leading-tight">
              Irreversible
              <br />
              Destruction
            </h1>
            <p className="mt-4 text-sm md:text-base opacity-90 max-w-sm">
              Once destroyed, your encrypted archive cannot be reconstructed. There is no
              backup, no admin override, no recovery path. Zero-knowledge means zero recovery.
            </p>
          </div>

          <dl className="space-y-3 text-xs uppercase tracking-[0.2em] opacity-80">
            <div className="flex justify-between">
              <dt>Archive status</dt>
              <dd>{vault ? "Active" : "Empty"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Encryption key</dt>
              <dd>Held only by you</dd>
            </div>
          </dl>
        </aside>

        <section className="bg-surface p-10 space-y-6">
          <div>
            <h2 className="font-headline text-2xl font-extrabold text-primary leading-tight">
              Terminate Your Continuity Plan?
            </h2>
            <p className="text-on-surface-variant text-sm mt-2">
              This wipes the vault, every protocol, contact, message, audit entry and the user
              record itself.
            </p>
          </div>

          <div className="bg-error/10 border border-error/20 rounded-2xl p-4 text-sm text-error">
            <p className="font-bold uppercase tracking-widest text-[10px] mb-1">
              ⚠ Warning
            </p>
            This action cannot be undone. We recommend exporting your Recovery Kit and pausing
            Life Check first if you only need a temporary stop.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-container-low rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                Vault data
              </p>
              <p className="font-headline text-lg font-bold text-on-surface mt-1">
                {itemCount} encrypted items
              </p>
            </div>
            <div className="bg-surface-container-low rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                Protocols
              </p>
              <p className="font-headline text-lg font-bold text-on-surface mt-1">
                Life Check, Scenario, Messages
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <ErrorAlert message={error} />
            <div className="space-y-2">
              <Label>
                Type <span className="font-mono text-error">DELETE</span> to confirm
              </Label>
              <Input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="submit"
                variant="destructive"
                size="md"
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? "Terminating..." : "Confirm Permanent Deletion"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => router.push("/settings")}
                className="flex-1"
              >
                Keep My Plan
              </Button>
            </div>
          </form>

          <p className="text-[10px] text-outline-variant font-mono">
            Request ID: {requestId || "—"}
          </p>
        </section>
      </div>
    </div>
  );
}
