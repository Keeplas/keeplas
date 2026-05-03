import type { Id } from "@keeplas/backend/_generated/dataModel";

export const BLOOD_TYPES = [
  "A+",
  "A-",
  "B+",
  "B-",
  "O+",
  "O-",
  "AB+",
  "AB-",
] as const;

export interface CardFormData {
  fullName: string;
  bloodType: string;
  allergies: string;
  medicalConditions: string;
  medications: string;
  emergencyContactId: Id<"trusted_contacts"> | null;
  emergencyContactRelation: string;
  additionalNotes: string;
}

export interface PrivacyToggles {
  showFullName: boolean;
  showBloodType: boolean;
  showAllergies: boolean;
  showMedicalConditions: boolean;
  showMedications: boolean;
  showEmergencyContact: boolean;
  showAdditionalNotes: boolean;
}

export const INITIAL_FORM_DATA: CardFormData = {
  fullName: "",
  bloodType: "",
  allergies: "",
  medicalConditions: "",
  medications: "",
  emergencyContactId: null,
  emergencyContactRelation: "",
  additionalNotes: "",
};

export const INITIAL_TOGGLES: PrivacyToggles = {
  showFullName: false,
  showBloodType: false,
  showAllergies: false,
  showMedicalConditions: false,
  showMedications: false,
  showEmergencyContact: false,
  showAdditionalNotes: false,
};

export const ROLE_TO_RELATION_LABEL: Record<string, string> = {
  family: "Family",
  friend: "Friend",
  lawyer: "Lawyer",
  doctor: "Doctor",
  other: "",
};

// Tiptap emits `<p></p>` (or whitespace-wrapped variants) when the editor is
// empty — strip tags to detect truly empty rich-text content.
export function isRichTextEmpty(html: string | undefined | null): boolean {
  if (!html) return true;
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}
