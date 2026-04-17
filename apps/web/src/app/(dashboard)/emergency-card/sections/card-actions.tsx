"use client";

import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

interface CardActionsProps {
  qrUrl: string | null;
}

export function CardActions({ qrUrl }: CardActionsProps) {
  function handleCopy() {
    if (qrUrl) navigator.clipboard.writeText(qrUrl);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="mt-8 flex flex-col sm:flex-row gap-3">
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 px-6 py-3 bg-surface-container text-primary font-bold rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer"
      >
        <Icon path={ICON_PATHS.link} />
        Copy Link
      </button>
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 px-6 py-3 bg-surface-container text-primary font-bold rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer"
      >
        <Icon path={ICON_PATHS.print} />
        Print Physical Card
      </button>
    </div>
  );
}
