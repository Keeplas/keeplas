"use client";

import { Input, Label, PhoneInput, Switch } from "@keeplas/ui";
import type { CardFormData } from "./constants";

interface ContactSectionProps {
  formData: CardFormData;
  showEmergencyContact: boolean;
  onUpdate: <K extends keyof CardFormData>(key: K, value: CardFormData[K]) => void;
  onToggleEmergencyContact: () => void;
}

export function ContactSection({
  formData,
  showEmergencyContact,
  onUpdate,
  onToggleEmergencyContact,
}: ContactSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-headline-sm text-primary">
          Emergency Contact
        </h3>
        <Switch
          checked={showEmergencyContact}
          onCheckedChange={onToggleEmergencyContact}
          aria-label="Show Emergency Contact on public card"
        />
      </div>

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
