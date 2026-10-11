import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@keeplas/ui";

/**
 * A section 10 State Message shown as a modal over the app (flat Figma
 * scrim). `title` names the dialog for screen readers; the message inside
 * shows it.
 */
export function StateDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-scrim backdrop-blur-none"
        className="w-[456px] max-w-[calc(100%-32px)] rounded-lg border border-border-default bg-bg-surface p-0 shadow-card"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
