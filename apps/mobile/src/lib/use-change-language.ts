import { useCallback, useEffect } from "react";
import { useConvexAuth } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import {
  accountLanguageTag,
  resolveLanguage,
  type Language,
} from "@/i18n/translate";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";
import { useAuditedMutation } from "./use-audited-mutation";

/** Change the UI language on the device and, when signed in, on the account (D12). */
export function useChangeLanguage(): (language: Language) => void {
  const { setLanguage } = useI18n();
  const { isAuthenticated } = useConvexAuth();
  const updatePreferences = useAuditedMutation(api.users.updatePreferences);

  return useCallback(
    (language: Language) => {
      setLanguage(language);
      if (isAuthenticated) {
        updatePreferences({ language: accountLanguageTag(language) }).catch(
          () => undefined, // The device keeps the choice; retried on next change.
        );
      }
    },
    [setLanguage, isAuthenticated, updatePreferences],
  );
}

/** After sign-in, adopt the language saved on the account. */
export function AccountLanguageSync() {
  const { setLanguage } = useI18n();
  const { viewer } = useSession();
  const accountLanguage = viewer?.language;
  useEffect(() => {
    if (accountLanguage) setLanguage(resolveLanguage(accountLanguage));
  }, [accountLanguage, setLanguage]);
  return null;
}
