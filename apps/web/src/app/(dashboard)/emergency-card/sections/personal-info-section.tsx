"use client";

import {
  Input,
  Label,
  RichTextEditor,
  Select,
  SelectItem,
  Switch,
} from "@keeplas/ui";
import { BLOOD_TYPES, type CardFormData, type PrivacyToggles } from "./constants";

interface PersonalInfoSectionProps {
  formData: CardFormData;
  toggles: PrivacyToggles;
  onUpdate: <K extends keyof CardFormData>(key: K, value: CardFormData[K]) => void;
  onToggle: (key: keyof PrivacyToggles) => void;
}

export function PersonalInfoSection({
  formData,
  toggles,
  onUpdate,
  onToggle,
}: PersonalInfoSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
      <h3 className="text-headline-sm text-primary">
        Personal Information
      </h3>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="fullName">Full Name</Label>
          <Switch
            checked={toggles.showFullName}
            onCheckedChange={() => onToggle("showFullName")}
            aria-label="Show Full Name on public card"
          />
        </div>
        <Input
          id="fullName"
          value={formData.fullName}
          onChange={(e) => onUpdate("fullName", e.target.value)}
          placeholder="Your full name"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="bloodType">Blood Type</Label>
          <Switch
            checked={toggles.showBloodType}
            onCheckedChange={() => onToggle("showBloodType")}
            aria-label="Show Blood Type on public card"
          />
        </div>
        <Select
          id="bloodType"
          value={formData.bloodType}
          onValueChange={(v) => onUpdate("bloodType", v)}
          placeholder="Select blood type"
        >
          {BLOOD_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="allergies">Allergies</Label>
          <Switch
            checked={toggles.showAllergies}
            onCheckedChange={() => onToggle("showAllergies")}
            aria-label="Show Allergies on public card"
          />
        </div>
        <RichTextEditor
          value={formData.allergies}
          onChange={(html) => onUpdate("allergies", html)}
          placeholder="List any known allergies..."
          minHeight={120}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="medicalConditions">Medical Conditions</Label>
          <Switch
            checked={toggles.showMedicalConditions}
            onCheckedChange={() => onToggle("showMedicalConditions")}
            aria-label="Show Medical Conditions on public card"
          />
        </div>
        <RichTextEditor
          value={formData.medicalConditions}
          onChange={(html) => onUpdate("medicalConditions", html)}
          placeholder="Any ongoing medical conditions..."
          minHeight={120}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="medications">Current Medications</Label>
          <Switch
            checked={toggles.showMedications}
            onCheckedChange={() => onToggle("showMedications")}
            aria-label="Show Current Medications on public card"
          />
        </div>
        <RichTextEditor
          value={formData.medications}
          onChange={(html) => onUpdate("medications", html)}
          placeholder="List current medications..."
          minHeight={120}
        />
      </div>
    </div>
  );
}
