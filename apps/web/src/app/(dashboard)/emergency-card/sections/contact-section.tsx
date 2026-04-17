"use client";

import { Input, Label } from "@keeplas/ui";
import type { CardFormData } from "./constants";

interface ContactSectionProps {
  formData: CardFormData;
  onUpdate: <K extends keyof CardFormData>(key: K, value: CardFormData[K]) => void;
}

export function ContactSection({ formData, onUpdate }: ContactSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
      <h3 className="font-headline font-bold text-lg text-primary">
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
        <Input
          id="emergencyContactPhone"
          type="tel"
          value={formData.emergencyContactPhone}
          onChange={(e) => onUpdate("emergencyContactPhone", e.target.value)}
          placeholder="+1 (555) 000-0000"
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
