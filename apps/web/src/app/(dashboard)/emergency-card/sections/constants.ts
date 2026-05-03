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

