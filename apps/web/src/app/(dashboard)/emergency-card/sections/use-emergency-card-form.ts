"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { getErrorMessage } from "@/lib/utils";
import {
  INITIAL_FORM_DATA,
  INITIAL_TOGGLES,
  isRichTextEmpty,
  type CardFormData,
  type PrivacyToggles,
} from "./constants";

function normalizeRichText(html: string): string | undefined {
  return isRichTextEmpty(html) ? undefined : html;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 800;

export function useEmergencyCardForm() {
  const card = useQuery(api.emergency_cards.getMyCard);
  const createOrUpdate = useAuditedMutation(api.emergency_cards.createOrUpdate);

  const [formData, setFormData] = useState<CardFormData>(INITIAL_FORM_DATA);
  const [toggles, setToggles] = useState<PrivacyToggles>(INITIAL_TOGGLES);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");

  const lastSavedRef = useRef<{
    formData: CardFormData;
    toggles: PrivacyToggles;
  }>({ formData: INITIAL_FORM_DATA, toggles: INITIAL_TOGGLES });

  const selectedContact = useQuery(
    api.trusted_contacts.getContact,
    formData.emergencyContactId
      ? { contactId: formData.emergencyContactId }
      : "skip"
  );

  useEffect(() => {
    if (!card) return;
    const hydratedForm: CardFormData = {
      fullName: card.fullName ?? "",
      bloodType: card.bloodType ?? "",
      allergies: card.allergies ?? "",
      medicalConditions: card.medicalConditions ?? "",
      medications: card.medications ?? "",
      emergencyContactId: card.emergencyContactId ?? null,
      emergencyContactRelation: card.emergencyContactRelation ?? "",
      additionalNotes: card.additionalNotes ?? "",
    };
    const hydratedToggles: PrivacyToggles = {
      showFullName: card.showFullName,
      showBloodType: card.showBloodType,
      showAllergies: card.showAllergies,
      showMedicalConditions: card.showMedicalConditions,
      showMedications: card.showMedications,
      showEmergencyContact: card.showEmergencyContact,
      showAdditionalNotes: card.showAdditionalNotes,
    };
    setFormData(hydratedForm);
    setToggles(hydratedToggles);
    lastSavedRef.current = {
      formData: hydratedForm,
      toggles: hydratedToggles,
    };
  }, [card]);

  useEffect(() => {
    const last = lastSavedRef.current;
    const unchanged =
      JSON.stringify(formData) === JSON.stringify(last.formData) &&
      JSON.stringify(toggles) === JSON.stringify(last.toggles);
    if (unchanged) return;

    const timer = setTimeout(async () => {
      setStatus("saving");
      setError("");
      try {
        await createOrUpdate({
          fullName: formData.fullName || undefined,
          bloodType: formData.bloodType || undefined,
          allergies: normalizeRichText(formData.allergies),
          medicalConditions: normalizeRichText(formData.medicalConditions),
          medications: normalizeRichText(formData.medications),
          emergencyContactId: formData.emergencyContactId ?? undefined,
          emergencyContactRelation:
            formData.emergencyContactRelation || undefined,
          additionalNotes: normalizeRichText(formData.additionalNotes),
          ...toggles,
        });
        lastSavedRef.current = { formData, toggles };
        setStatus("saved");
      } catch (err) {
        setError(getErrorMessage(err, "Failed to save emergency card"));
        setStatus("error");
      }
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [formData, toggles, createOrUpdate]);

  function updateField<K extends keyof CardFormData>(
    key: K,
    value: CardFormData[K]
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function updateToggle(key: keyof PrivacyToggles) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return {
    card,
    formData,
    toggles,
    selectedContact: selectedContact ?? null,
    status,
    error,
    updateField,
    updateToggle,
  };
}
