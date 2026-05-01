"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { isValidPhone } from "@keeplas/ui";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { getErrorMessage } from "@/lib/utils";
import {
  INITIAL_FORM_DATA,
  INITIAL_TOGGLES,
  type CardFormData,
  type PrivacyToggles,
} from "./constants";

export function useEmergencyCardForm() {
  const card = useQuery(api.emergency_cards.getMyCard);
  const createOrUpdate = useAuditedMutation(api.emergency_cards.createOrUpdate);

  const [formData, setFormData] = useState<CardFormData>(INITIAL_FORM_DATA);
  const [toggles, setToggles] = useState<PrivacyToggles>(INITIAL_TOGGLES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!card) return;
    setFormData({
      fullName: card.fullName ?? "",
      bloodType: card.bloodType ?? "",
      allergies: card.allergies ?? "",
      medicalConditions: card.medicalConditions ?? "",
      medications: card.medications ?? "",
      emergencyContactName: card.emergencyContactName ?? "",
      emergencyContactPhone: card.emergencyContactPhone ?? "",
      emergencyContactRelation: card.emergencyContactRelation ?? "",
      additionalNotes: card.additionalNotes ?? "",
    });
    setToggles({
      showFullName: card.showFullName,
      showBloodType: card.showBloodType,
      showAllergies: card.showAllergies,
      showMedicalConditions: card.showMedicalConditions,
      showMedications: card.showMedications,
      showEmergencyContact: card.showEmergencyContact,
      showAdditionalNotes: card.showAdditionalNotes,
    });
  }, [card]);

  function updateField<K extends keyof CardFormData>(
    key: K,
    value: CardFormData[K]
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function updateToggle(key: keyof PrivacyToggles) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (
      formData.emergencyContactPhone &&
      !isValidPhone(formData.emergencyContactPhone)
    ) {
      setError("Please enter a valid phone number");
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      await createOrUpdate({
        fullName: formData.fullName || undefined,
        bloodType: formData.bloodType || undefined,
        allergies: formData.allergies || undefined,
        medicalConditions: formData.medicalConditions || undefined,
        medications: formData.medications || undefined,
        emergencyContactName: formData.emergencyContactName || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
        emergencyContactRelation:
          formData.emergencyContactRelation || undefined,
        additionalNotes: formData.additionalNotes || undefined,
        ...toggles,
      });
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save emergency card"));
    } finally {
      setSaving(false);
    }
  }

  return {
    card,
    formData,
    toggles,
    saving,
    error,
    saved,
    updateField,
    updateToggle,
    handleSave,
  };
}
