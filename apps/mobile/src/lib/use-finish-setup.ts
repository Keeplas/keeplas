import { useCallback } from "react";
import { useRouter } from "expo-router";

import { useVault } from "@/providers/vault-provider";

/** Leave the setup screens: forget the 24 words, open the app. */
export function useFinishSetup() {
  const router = useRouter();
  const { setSetupPhrase } = useVault();
  return useCallback(() => {
    setSetupPhrase(null);
    router.replace("/home");
  }, [router, setSetupPhrase]);
}
