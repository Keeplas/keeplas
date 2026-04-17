"use client";

import { Textarea } from "@keeplas/ui";

interface NotesSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export function NotesSection({ value, onChange }: NotesSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
      <h3 className="font-headline font-bold text-lg text-primary">
        Additional Notes
      </h3>
      <Textarea
        id="additionalNotes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Any other information responders should know..."
        rows={4}
      />
    </div>
  );
}

