"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from "@keeplas/ui";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  MemorialIntroductionCard,
  type MemorialIntroductionData,
} from "./memorial-introduction-card";

interface MemorialIntroductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerName: string;
  contactId: Id<"trusted_contacts">;
  introductions: MemorialIntroductionData[];
}

export function MemorialIntroductionDialog({
  open,
  onOpenChange,
  ownerName,
  contactId,
  introductions,
}: MemorialIntroductionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface max-w-2xl w-[calc(100%-2rem)] max-h-[92vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 static">
          <div className="flex-1 min-w-0">
            <DialogTitle>A message from {ownerName}</DialogTitle>
            <DialogDescription className="mt-1">
              Take a moment — this was left for you.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-8 px-6 pb-6 pt-4 flex-1 overflow-y-auto min-h-0">
          {introductions.map((intro) => (
            <MemorialIntroductionCard
              key={intro._id}
              contactId={contactId}
              intro={intro}
            />
          ))}
        </div>

        <div className="shrink-0 border-t border-outline-variant/10 px-6 py-4 bg-surface">
          <Button
            type="button"
            variant="vault"
            size="md"
            onClick={() => onOpenChange(false)}
            className="w-full cursor-pointer"
          >
            Continue to the vault
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
