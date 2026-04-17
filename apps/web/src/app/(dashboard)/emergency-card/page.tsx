"use client";

import { Button, ErrorAlert } from "@keeplas/ui";
import { EmergencyCardPreview } from "./emergency-card-preview";
import { CardActions } from "./sections/card-actions";
import { ContactSection } from "./sections/contact-section";
import { NotesSection } from "./sections/notes-section";
import { PersonalInfoSection } from "./sections/personal-info-section";
import { PrivacyControls } from "./sections/privacy-controls";
import { useEmergencyCardForm } from "./sections/use-emergency-card-form";

export default function EmergencyCardPage() {
  const {
    card,
    formData,
    toggles,
    saving,
    error,
    saved,
    updateField,
    updateToggle,
    handleSave,
  } = useEmergencyCardForm();

  const qrUrl = card?.qrCodeToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/emergency/${card.qrCodeToken}`
    : null;

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-10 max-w-2xl">
        <h1 className="font-headline text-primary text-3xl md:text-4xl font-extrabold tracking-tight leading-none mb-3">
          Emergency Card
        </h1>
        <p className="text-on-surface-variant text-sm md:text-base">
          Customize your public safety profile. This information remains accessible to responders even when your vault is locked.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <section className="lg:col-span-5 space-y-6 order-last lg:order-none">
          <form onSubmit={handleSave} className="space-y-6">
            <PersonalInfoSection formData={formData} onUpdate={updateField} />
            <ContactSection formData={formData} onUpdate={updateField} />
            <NotesSection
              value={formData.additionalNotes}
              onChange={(v) => updateField("additionalNotes", v)}
            />
            <PrivacyControls toggles={toggles} onToggle={updateToggle} />

            {error && <ErrorAlert message={error} />}

            {saved && (
              <div className="bg-secondary/10 text-secondary rounded-xl p-4 text-sm font-medium">
                Emergency card saved successfully.
              </div>
            )}

            <Button
              type="submit"
              variant="vault"
              size="xl"
              disabled={saving}
              className="w-full tracking-wide cursor-pointer"
            >
              {saving
                ? "Saving..."
                : card
                  ? "Update Digital Card"
                  : "Create Digital Card"}
            </Button>
          </form>
        </section>

        <section className="lg:col-span-7 order-first lg:order-none lg:sticky lg:top-6 lg:self-start flex flex-col items-center lg:items-end">
          <div className="w-full max-w-[260px] sm:max-w-xs md:max-w-sm lg:max-w-md">
            <EmergencyCardPreview
              formData={formData}
              toggles={toggles}
              qrUrl={qrUrl}
            />
          </div>

          {card && <CardActions qrUrl={qrUrl} />}
        </section>
      </div>
    </div>
  );
}
