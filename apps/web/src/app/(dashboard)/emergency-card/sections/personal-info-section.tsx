"use client";

import { Input, Label, Select, SelectItem, Textarea } from "@keeplas/ui";
import { BLOOD_TYPES, type CardFormData } from "./constants";

interface PersonalInfoSectionProps {
  formData: CardFormData;
  onUpdate: <K extends keyof CardFormData>(key: K, value: CardFormData[K]) => void;
}

export function PersonalInfoSection({
  formData,
  onUpdate,
}: PersonalInfoSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
      <h3 className="text-headline-sm text-primary">
        Personal Information
      </h3>

      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          value={formData.fullName}
          onChange={(e) => onUpdate("fullName", e.target.value)}
          placeholder="Your full name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bloodType">Blood Type</Label>
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
        <Label htmlFor="allergies">Allergies</Label>
        <Textarea
          id="allergies"
          value={formData.allergies}
          onChange={(e) => onUpdate("allergies", e.target.value)}
          placeholder="List any known allergies..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="medicalConditions">Medical Conditions</Label>
        <Textarea
          id="medicalConditions"
          value={formData.medicalConditions}
          onChange={(e) => onUpdate("medicalConditions", e.target.value)}
          placeholder="Any ongoing medical conditions..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="medications">Current Medications</Label>
        <Textarea
          id="medications"
          value={formData.medications}
          onChange={(e) => onUpdate("medications", e.target.value)}
          placeholder="List current medications..."
          rows={3}
        />
      </div>
    </div>
  );
}
