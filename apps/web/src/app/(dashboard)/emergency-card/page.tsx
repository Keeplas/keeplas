"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Input, Label, Select, SelectItem, Switch, Textarea, ErrorAlert } from "@keeplas/ui";
import { EmergencyCardPreview } from "./emergency-card-preview";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

interface CardFormData {
  fullName: string;
  bloodType: string;
  allergies: string;
  medicalConditions: string;
  medications: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  additionalNotes: string;
}

interface PrivacyToggles {
  showFullName: boolean;
  showBloodType: boolean;
  showAllergies: boolean;
  showMedicalConditions: boolean;
  showMedications: boolean;
  showEmergencyContact: boolean;
  showAdditionalNotes: boolean;
}

const PRIVACY_FIELDS = [
  { key: "showFullName" as const, label: "Full Name", icon: "person" },
  { key: "showBloodType" as const, label: "Blood Type", icon: "bloodtype" },
  { key: "showAllergies" as const, label: "Allergies", icon: "warning" },
  { key: "showMedicalConditions" as const, label: "Medical Conditions", icon: "medical_information" },
  { key: "showMedications" as const, label: "Medications", icon: "medication" },
  { key: "showEmergencyContact" as const, label: "Emergency Contact", icon: "contact_phone" },
  { key: "showAdditionalNotes" as const, label: "Additional Notes", icon: "notes" },
] as const;

export default function EmergencyCardPage() {
  const card = useQuery(api.emergency_cards.getMyCard);
  const createOrUpdate = useMutation(api.emergency_cards.createOrUpdate);

  const [formData, setFormData] = useState<CardFormData>({
    fullName: "",
    bloodType: "",
    allergies: "",
    medicalConditions: "",
    medications: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    additionalNotes: "",
  });

  const [toggles, setToggles] = useState<PrivacyToggles>({
    showFullName: false,
    showBloodType: false,
    showAllergies: false,
    showMedicalConditions: false,
    showMedications: false,
    showEmergencyContact: false,
    showAdditionalNotes: false,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Populate form from existing card
  useEffect(() => {
    if (card) {
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
    }
  }, [card]);

  function updateField<K extends keyof CardFormData>(key: K, value: CardFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function updateToggle(key: keyof PrivacyToggles) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
        emergencyContactRelation: formData.emergencyContactRelation || undefined,
        additionalNotes: formData.additionalNotes || undefined,
        ...toggles,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save emergency card");
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const qrUrl = card?.qrCodeToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/emergency/${card.qrCodeToken}`
    : null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-10 max-w-2xl">
        <h1 className="font-headline text-primary text-3xl md:text-4xl font-extrabold tracking-tight leading-none mb-3">
          Emergency Card
        </h1>
        <p className="text-on-surface-variant text-sm md:text-base">
          Customize your public safety profile. This information remains accessible to responders even when your vault is locked.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left: Form + Privacy Controls */}
        <section className="lg:col-span-5 space-y-6 order-last lg:order-none">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Personal Information */}
            <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
              <h3 className="font-headline font-bold text-lg text-primary">Personal Information</h3>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bloodType">Blood Type</Label>
                <Select
                  id="bloodType"
                  value={formData.bloodType}
                  onValueChange={(v) => updateField("bloodType", v)}
                  placeholder="Select blood type"
                >
                  {BLOOD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="allergies">Allergies</Label>
                <Textarea
                  id="allergies"
                  value={formData.allergies}
                  onChange={(e) => updateField("allergies", e.target.value)}
                  placeholder="List any known allergies..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="medicalConditions">Medical Conditions</Label>
                <Textarea
                  id="medicalConditions"
                  value={formData.medicalConditions}
                  onChange={(e) => updateField("medicalConditions", e.target.value)}
                  placeholder="Any ongoing medical conditions..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="medications">Current Medications</Label>
                <Textarea
                  id="medications"
                  value={formData.medications}
                  onChange={(e) => updateField("medications", e.target.value)}
                  placeholder="List current medications..."
                  rows={3}
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
              <h3 className="font-headline font-bold text-lg text-primary">Emergency Contact</h3>

              <div className="space-y-2">
                <Label htmlFor="emergencyContactName">Contact Name</Label>
                <Input
                  id="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={(e) => updateField("emergencyContactName", e.target.value)}
                  placeholder="Emergency contact name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyContactPhone">Phone Number</Label>
                <Input
                  id="emergencyContactPhone"
                  type="tel"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => updateField("emergencyContactPhone", e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyContactRelation">Relationship</Label>
                <Input
                  id="emergencyContactRelation"
                  value={formData.emergencyContactRelation}
                  onChange={(e) => updateField("emergencyContactRelation", e.target.value)}
                  placeholder="e.g. Spouse, Parent, Sibling"
                />
              </div>
            </div>

            {/* Additional Notes */}
            <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
              <h3 className="font-headline font-bold text-lg text-primary">Additional Notes</h3>
              <Textarea
                id="additionalNotes"
                value={formData.additionalNotes}
                onChange={(e) => updateField("additionalNotes", e.target.value)}
                placeholder="Any other information responders should know..."
                rows={4}
              />
            </div>

            {/* Privacy Controls */}
            <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
              <h3 className="font-headline font-bold text-lg text-primary">Privacy Controls</h3>
              <p className="text-sm text-on-surface-variant">
                Choose which fields are visible on your public emergency card. All toggles are off by default for maximum privacy.
              </p>
              <div className="space-y-4">
                {PRIVACY_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-secondary text-xl" aria-hidden="true">
                        {field.icon === "person" && (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                          </svg>
                        )}
                        {field.icon === "bloodtype" && (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c0 0-7.5 7.5-7.5 12a7.5 7.5 0 0 0 15 0c0-4.5-7.5-12-7.5-12Z" />
                          </svg>
                        )}
                        {field.icon === "warning" && (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                          </svg>
                        )}
                        {field.icon === "medical_information" && (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75" />
                          </svg>
                        )}
                        {field.icon === "medication" && (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 6 1.125-2.25M14.25 6l-1.125-2.25M6 15h12M6 15l-2.25 4.5M6 15l2.25 4.5M18 15l2.25 4.5M18 15l-2.25 4.5M6.75 2.25h10.5a.75.75 0 0 1 .75.75v3a3.75 3.75 0 0 1-3.75 3.75h-4.5A3.75 3.75 0 0 1 6 6V3a.75.75 0 0 1 .75-.75Z" />
                          </svg>
                        )}
                        {field.icon === "contact_phone" && (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                          </svg>
                        )}
                        {field.icon === "notes" && (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                        )}
                      </span>
                      <span className="font-medium text-on-surface">{field.label}</span>
                    </div>
                    <Switch
                      checked={toggles[field.key]}
                      onCheckedChange={() => updateToggle(field.key)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {error && <ErrorAlert message={error} />}

            {saved && (
              <div className="bg-secondary/10 text-secondary rounded-xl p-4 text-sm font-medium">
                Emergency card saved successfully.
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="vault-gradient text-on-primary w-full py-4 rounded-xl font-headline font-bold tracking-wide hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {saving ? "Saving..." : card ? "Update Digital Card" : "Create Digital Card"}
            </button>
          </form>
        </section>

        {/* Right: Card Preview + Actions — sticky on desktop so preview stays visible while filling the form */}
        <section className="lg:col-span-7 order-first lg:order-none lg:sticky lg:top-6 lg:self-start flex flex-col items-center lg:items-end">
          <div className="w-full max-w-[260px] sm:max-w-xs md:max-w-sm lg:max-w-md">
            <EmergencyCardPreview
              formData={formData}
              toggles={toggles}
              qrUrl={qrUrl}
            />
          </div>

          {/* Secondary Actions */}
          {card && (
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  if (qrUrl) {
                    navigator.clipboard.writeText(qrUrl);
                  }
                }}
                className="flex items-center gap-2 px-6 py-3 bg-surface-container text-primary font-bold rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364l1.757 1.757" />
                </svg>
                Copy Link
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-6 py-3 bg-surface-container text-primary font-bold rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                </svg>
                Print Physical Card
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
