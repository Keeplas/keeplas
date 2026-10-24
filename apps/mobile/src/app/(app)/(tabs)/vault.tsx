import { VaultListScreen } from "@/features/vault/vault-list-screen";

/** Vault tab: every item ("All items"), with search and list chips. */
export default function VaultTab() {
  return <VaultListScreen initial="all" />;
}
