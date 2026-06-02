import { useState } from "react";
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
import { useTranslations } from "@/lib/i18n";

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
  const t = useTranslations("settingsSecurity");
  const updateResidence = useAuditedMutation(api.users.updateLegalResidence);

  const [country, setCountry] = useState(currentCountry ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset the form each time the dialog opens, adjusting during render instead
  // of syncing in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCountry(currentCountry ?? "");
      setError("");
    }
  }

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
      setError(getErrorMessage(err, t("residence.error")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface max-w-lg p-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 static">
          <div className="flex-1 min-w-0">
            <DialogTitle>{t("residence.title")}</DialogTitle>
            <DialogDescription className="mt-1">
              {t("residence.description")}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 px-6 pb-6 pt-4 flex-1 overflow-y-auto min-h-0"
        >
          <div className="space-y-2">
            <Label htmlFor="residence-country">
              {t("residence.countryLabel")}
            </Label>
            <CountryCombobox
              id="residence-country"
              value={country}
              onChange={setCountry}
            />
            <p className="text-label-md text-on-surface-variant">
              {t("residence.countryHint")}
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
              {t("residence.cancel")}
            </Button>
            <Button
              type="submit"
              variant="vault"
              size="md"
              disabled={saving || !country || unchanged}
              className="flex-1 cursor-pointer"
            >
              {saving ? t("residence.saving") : t("residence.confirm")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
