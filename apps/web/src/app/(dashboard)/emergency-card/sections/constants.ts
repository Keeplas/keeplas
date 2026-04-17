import { ICON_PATHS } from "@/lib/icons";

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
  emergencyContactName: string;
  emergencyContactPhone: string;
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
  emergencyContactName: "",
  emergencyContactPhone: "",
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

export const PRIVACY_FIELDS: Array<{
  key: keyof PrivacyToggles;
  label: string;
  iconPath: string;
}> = [
  { key: "showFullName", label: "Full Name", iconPath: ICON_PATHS.user },
  { key: "showBloodType", label: "Blood Type", iconPath: ICON_PATHS.bloodDrop },
  { key: "showAllergies", label: "Allergies", iconPath: ICON_PATHS.warning },
  {
    key: "showMedicalConditions",
    label: "Medical Conditions",
    iconPath: ICON_PATHS.doctor,
  },
  {
    key: "showMedications",
    label: "Medications",
    iconPath: ICON_PATHS.pill,
  },
  {
    key: "showEmergencyContact",
    label: "Emergency Contact",
    iconPath: ICON_PATHS.phone,
  },
  {
    key: "showAdditionalNotes",
    label: "Additional Notes",
    iconPath: ICON_PATHS.notes,
  },
];
