import { useCallback } from "react";
import { useRouter } from "expo-router";

import { useVault } from "@/providers/vault-provider";

/** Leave the setup screens, open the app. */
export function useFinishSetup() {
  const router = useRouter();
  const { setFinishingSetup } = useVault();
  return useCallback(() => {
    setFinishingSetup(false);
    router.replace("/home");
  }, [router, setFinishingSetup]);
}
