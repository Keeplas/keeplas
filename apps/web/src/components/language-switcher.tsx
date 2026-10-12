import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useLocale, useSetLocale, useTranslations } from "@/lib/i18n";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { locales, userLanguageForLocale, type Locale } from "@/lib/locale";

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

// Figma "Language Dropdown", used on the signed-out screens. Switching updates
// the active locale (and localStorage) for the whole tree.
//
// For an authenticated viewer it also persists the choice to `users.language`,
// so the preference survives navigation and reloads (otherwise `ViewerLocaleSync`
// would re-apply the stale DB value).
export function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const setLocale = useSetLocale();
  const viewer = useQuery(api.users.viewer);
  const updatePreferences = useAuditedMutation(api.users.updatePreferences);

  function choose(next: Locale) {
    setLocale(next);
    if (viewer) {
      void updatePreferences({
        language: userLanguageForLocale(next),
      }).catch(() => undefined);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("language")}
        className="inline-flex items-center gap-[4px] rounded-sm border border-border-default py-[5px] pl-[10px] pr-[8px] text-caption text-text-primary transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        {locale.toUpperCase()}
        <Icon path={ICON_PATHS.chevronDown} className="size-[14px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[140px] border border-border-default bg-bg-surface"
      >
        {locales.map((value) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => choose(value)}
            className="text-body-sm text-text-primary focus:bg-bg-subtle"
          >
            {LANGUAGE_NAMES[value]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
