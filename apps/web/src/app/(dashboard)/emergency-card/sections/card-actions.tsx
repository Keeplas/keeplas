"use client";

import { Icon, toast } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

interface CardActionsProps {
  qrUrl: string | null;
}

export function CardActions({ qrUrl }: CardActionsProps) {
  async function handleCopy() {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      toast({
        variant: "success",
        title: "Link copied",
        description: "Emergency card link is now on your clipboard.",
      });
    } catch {
      toast({
        variant: "error",
        title: "Copy failed",
        description: "We couldn't access the clipboard. Try copying manually.",
      });
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-3">
      <button
        onClick={handleCopy}
        className="flex items-center justify-center gap-2 px-4 py-3 bg-surface-container text-primary font-bold rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer"
      >
        <Icon path={ICON_PATHS.link} />
        Copy Link
      </button>
      <button
        onClick={handlePrint}
        className="flex items-center justify-center gap-2 px-4 py-3 bg-surface-container text-primary font-bold rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer"
      >
        <Icon path={ICON_PATHS.print} />
        Print Physical Card
      </button>
    </div>
  );
}
