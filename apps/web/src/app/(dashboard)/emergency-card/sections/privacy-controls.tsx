"use client";

import { Icon, Switch } from "@keeplas/ui";
import { PRIVACY_FIELDS, type PrivacyToggles } from "./constants";

interface PrivacyControlsProps {
  toggles: PrivacyToggles;
  onToggle: (key: keyof PrivacyToggles) => void;
}

export function PrivacyControls({ toggles, onToggle }: PrivacyControlsProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
      <h3 className="font-headline font-bold text-lg text-primary">
        Privacy Controls
      </h3>
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
              <Icon path={field.iconPath} className="w-5 h-5 text-secondary" />
              <span className="font-medium text-on-surface">{field.label}</span>
            </div>
            <Switch
              checked={toggles[field.key]}
              onCheckedChange={() => onToggle(field.key)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
