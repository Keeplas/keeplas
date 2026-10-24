import { useLocalSearchParams, useRouter } from "expo-router";

import { isVaultListKey } from "@/features/home/vault-groups";
import { VaultListScreen } from "@/features/vault/vault-list-screen";

export default function VaultGroup() {
  const { group = "" } = useLocalSearchParams<{ group: string }>();
  const router = useRouter();
  return (
    <VaultListScreen
      initial={isVaultListKey(group) ? group : "all"}
      onBack={router.back}
    />
  );
}
