"use client";

import { Input, Label, PhoneInput } from "@keeplas/ui";
import type { CardFormData } from "./constants";

interface ContactSectionProps {
  formData: CardFormData;
  onUpdate: <K extends keyof CardFormData>(key: K, value: CardFormData[K]) => void;
}

export function ContactSection({ formData, onUpdate }: ContactSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
      <h3 className="text-headline-sm text-primary">
        Emergency Contact
      </h3>

      <div className="space-y-2">
        <Label htmlFor="emergencyContactName">Contact Name</Label>
        <Input
          id="emergencyContactName"
          value={formData.emergencyContactName}
          onChange={(e) => onUpdate("emergencyContactName", e.target.value)}
          placeholder="Emergency contact name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyContactPhone">Phone Number</Label>
        <PhoneInput
          id="emergencyContactPhone"
          value={formData.emergencyContactPhone || undefined}
          onChange={(v) => onUpdate("emergencyContactPhone", v ?? "")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyContactRelation">Relationship</Label>
        <Input
          id="emergencyContactRelation"
          value={formData.emergencyContactRelation}
          onChange={(e) => onUpdate("emergencyContactRelation", e.target.value)}
          placeholder="e.g. Spouse, Parent, Sibling"
        />
      </div>
    </div>
  );
}
