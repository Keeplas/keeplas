"use client";

import { RichTextEditor, Switch } from "@keeplas/ui";

interface NotesSectionProps {
  value: string;
  showAdditionalNotes: boolean;
  onChange: (value: string) => void;
  onToggleAdditionalNotes: () => void;
}

export function NotesSection({
  value,
  showAdditionalNotes,
  onChange,
  onToggleAdditionalNotes,
}: NotesSectionProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-headline-sm text-primary">
          Additional Notes
        </h3>
        <Switch
          checked={showAdditionalNotes}
          onCheckedChange={onToggleAdditionalNotes}
          aria-label="Show Additional Notes on public card"
        />
      </div>
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder="Any other information responders should know..."
        minHeight={160}
      />
    </div>
  );
}
