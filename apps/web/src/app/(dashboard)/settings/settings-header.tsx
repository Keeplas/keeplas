"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@keeplas/ui";
import { DialogTitle, DialogDescription } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

interface SectionMeta {
  title: string;
  description: string;
}

const SECTION_META: Record<string, SectionMeta> = {
  "/settings": {
    title: "Identity",
    description: "Update your account information and how others see you on the platform.",
  },
  "/settings/security": {
    title: "Security Center",
    description:
      "Social recovery, Shamir shards, biometrics and hash-chained audit log.",
  },
  "/settings/preferences": {
    title: "Preferences",
    description: "Localization and alert preferences for your legacy system.",
  },
  "/settings/recovery-kit": {
    title: "Recovery Kit",
    description: "Export the printable kit that rebuilds your vault if access is lost.",
  },
  "/settings/subscription": {
    title: "Subscription",
    description: "Plans, billing, and the lifetime tier for your legacy.",
  },
};

const FALLBACK: SectionMeta = {
  title: "Settings",
  description: "Configure your digital sanctuary.",
};

function lookupSection(pathname: string | null): SectionMeta {
  if (!pathname) return FALLBACK;
  return SECTION_META[pathname] ?? FALLBACK;
}

export function SettingsHeader({
  onClose,
  onOpenMenu,
}: {
  onClose: () => void;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();
  const { title, description } = lookupSection(pathname);

  return (
    <header className="flex items-start justify-between gap-4 px-6 md:px-8 py-5 md:py-6 border-b border-outline-variant/15">
      <div className="flex items-start gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open settings navigation"
          className="lg:hidden shrink-0 p-2 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors cursor-pointer -ml-1"
        >
          <Icon path={ICON_PATHS.menu} className="w-5 h-5" />
        </button>
        <div className="min-w-0 space-y-1">
          <DialogTitle className="font-headline text-xl md:text-2xl font-extrabold text-primary tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-on-surface-variant">
            {description}
          </DialogDescription>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close settings"
        className="shrink-0 p-2 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
      >
        <Icon path={ICON_PATHS.close} className="w-5 h-5" />
      </button>
    </header>
  );
}
