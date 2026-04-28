"use client";

import { useEffect, useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Label,
  ErrorAlert,
} from "@keeplas/ui";
import { CountryCombobox } from "@/components/country-combobox";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { getErrorMessage } from "@/lib/utils";

interface UpdateResidenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCountry?: string;
}

export function UpdateResidenceDialog({
  open,
  onOpenChange,
  currentCountry,
}: UpdateResidenceDialogProps) {
  const updateResidence = useAuditedMutation(api.users.updateLegalResidence);

  const [country, setCountry] = useState(currentCountry ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setCountry(currentCountry ?? "");
      setError("");
    }
  }, [open, currentCountry]);

  const unchanged =
    !!currentCountry && country.toUpperCase() === currentCountry.toUpperCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!country || unchanged) return;

    setSaving(true);
    setError("");

    try {
      await updateResidence({ country });
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update legal residence"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface max-w-lg p-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 static">
          <div className="flex-1 min-w-0">
            <DialogTitle>Update legal residence</DialogTitle>
            <DialogDescription className="mt-1">
              Change the country whose inheritance jurisdiction applies to your
              vault. Your original declaration is preserved unchanged in the
              audit log — this update is recorded as a new tamper-evident entry.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 px-6 pb-6 pt-4 flex-1 overflow-y-auto min-h-0"
        >
          <div className="space-y-2">
            <Label htmlFor="residence-country">New country of residence</Label>
            <CountryCombobox
              id="residence-country"
              value={country}
              onChange={setCountry}
            />
            <p className="text-label-md text-on-surface-variant">
              Pick the country where you currently reside. Birthday cannot be
              changed.
            </p>
          </div>

          {error && <ErrorAlert message={error} />}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-surface-container-low hover:bg-surface-container-high cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="vault"
              size="md"
              disabled={saving || !country || unchanged}
              className="flex-1 cursor-pointer"
            >
              {saving ? "Saving…" : "Confirm update"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
