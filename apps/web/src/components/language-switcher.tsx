import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { cn } from "@keeplas/ui";
import { useLocale, useSetLocale } from "@/lib/i18n";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { userLanguageForLocale } from "@/lib/locale";

interface LanguageSwitcherProps {
  className?: string;
}

// Self-contained toggle driven by the i18n context. Used in the pre-auth and
// onboarding flows; switching updates the active locale (and localStorage) for
// the whole tree. Components that need the chosen value (e.g. to send an OTP in
// the right language) read it with `useLocale()`.
//
// For an authenticated viewer it also persists the choice to `users.language`,
// so the preference survives navigation and reloads (otherwise `ViewerLocaleSync`
// would re-apply the stale DB value). Pre-auth there is no viewer, so we only
// touch the local context — the chosen locale is carried into signup separately.
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const viewer = useQuery(api.users.viewer);
  const updatePreferences = useAuditedMutation(api.users.updatePreferences);
  const next = locale === "en" ? "fr" : "en";
  const flag = next === "fr" ? "🇫🇷" : "🇺🇸";

  return (
    <button
      type="button"
      onClick={() => {
        setLocale(next);
        if (viewer) {
          void updatePreferences({
            language: userLanguageForLocale(next),
          }).catch(() => undefined);
        }
      }}
      className={cn(
        "inline-flex min-w-24 cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary/25 px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-primary/75 transition-colors hover:border-primary/45 hover:bg-primary/5 hover:text-primary",
        className,
      )}
      aria-label="Language"
    >
      <span aria-hidden>{flag}</span>
      <span>{next.toUpperCase()}</span>
    </button>
  );
}
