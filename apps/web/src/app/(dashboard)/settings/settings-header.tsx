import { usePathname } from "@/lib/navigation";
import { Icon } from "@keeplas/ui";
import { DialogTitle, DialogDescription } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

// Maps a settings pathname to the i18n key suffix for its title/description.
const SECTION_KEYS: Record<string, string> = {
  "/settings": "identity",
  "/settings/security": "security",
  "/settings/preferences": "preferences",
  "/settings/recovery-kit": "recoveryKit",
  "/settings/subscription": "subscription",
  "/settings/contact": "contact",
  "/settings/roadmap": "roadmap",
};

function lookupSectionKey(pathname: string | null): string {
  if (!pathname) return "fallback";
  return SECTION_KEYS[pathname] ?? "fallback";
}

export function SettingsHeader({
  onClose,
  onOpenMenu,
}: {
  onClose: () => void;
  onOpenMenu: () => void;
}) {
  const t = useTranslations("settings");
  const pathname = usePathname();
  const sectionKey = lookupSectionKey(pathname);
  const title = t(`header.${sectionKey}.title`);
  const description = t(`header.${sectionKey}.description`);

  return (
    <header className="flex items-start justify-between gap-4 px-6 md:px-8 py-5 md:py-6 border-b border-outline-variant/15">
      <div className="flex items-start gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={t("header.openNav")}
          className="lg:hidden shrink-0 p-2 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors cursor-pointer -ml-1"
        >
          <Icon path={ICON_PATHS.menu} className="w-5 h-5" />
        </button>
        <div className="min-w-0 space-y-1">
          <DialogTitle className="text-headline-md text-primary">
            {title}
          </DialogTitle>
          <DialogDescription className="text-body-md text-on-surface-variant">
            {description}
          </DialogDescription>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("header.close")}
        className="shrink-0 p-2 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
      >
        <Icon path={ICON_PATHS.close} className="w-5 h-5" />
      </button>
    </header>
  );
}
