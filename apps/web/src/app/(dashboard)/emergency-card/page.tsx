"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  Icon,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
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

  const [previewOpen, setPreviewOpen] = useState(false);

  const qrUrl = card?.qrCodeToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/emergency/${card.qrCodeToken}`
    : null;

  return (
    <div className="max-w-screen-2xl mx-auto">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-headline-lg text-primary mb-3">
          Emergency Card
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          Customize your public safety profile. This information remains accessible to responders even when your vault is locked.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <section className="lg:col-span-5 space-y-6">
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
              <div className="bg-secondary/10 text-secondary rounded-xl p-4 text-body-md font-medium">
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

        <section className="hidden lg:col-span-7 lg:flex lg:sticky lg:top-6 lg:self-start flex-col items-end lg:pr-8 xl:pr-16">
          <div className="w-full max-w-[260px] sm:max-w-xs md:max-w-sm lg:max-w-md">
            <EmergencyCardPreview
              formData={formData}
              toggles={toggles}
              qrUrl={qrUrl}
            />

            {card && <CardActions qrUrl={qrUrl} />}
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className="lg:hidden fixed left-6 bottom-24 md:bottom-6 z-40 flex items-center gap-2 h-12 px-5 rounded-full bg-primary text-on-primary shadow-2xl shadow-primary/30 cursor-pointer hover:bg-primary-container transition-colors"
        aria-label="Preview emergency card"
      >
        <Icon path={ICON_PATHS.emergencyCard} className="w-5 h-5" />
        <span className="text-label-lg font-semibold">Preview Card</span>
      </button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b-0">
            <div>
              <DialogTitle className="text-headline-sm">Card Preview</DialogTitle>
              <DialogDescription className="mt-1">
                Live preview of your emergency card.
              </DialogDescription>
            </div>
            <DialogClose className="rounded-full p-1.5 hover:bg-surface-container cursor-pointer">
              <Icon path={ICON_PATHS.close} className="w-5 h-5" />
            </DialogClose>
          </DialogHeader>
          <div className="px-5 pb-6 flex flex-col items-center">
            <EmergencyCardPreview
              formData={formData}
              toggles={toggles}
              qrUrl={qrUrl}
            />
            {card && <CardActions qrUrl={qrUrl} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
