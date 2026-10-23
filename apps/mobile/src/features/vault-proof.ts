import { useCallback } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { vaultProofMessage } from "@keeplas/backend/lib/vault_proof";
import { signBytesAsync } from "@keeplas/crypto/sig";

import { unwrapSecretUnderMasterKey } from "@/crypto/vault-keys";
import { useViewer } from "@/providers/session-provider";

/**
 * Prove to the server that this session opened the vault: the identity key
 * (wrapped under the MasterKey) signs a single-use nonce. Unlocks the lost
 * authenticator reset and the number change (session_proofs.ts).
 */
export function useProveVault() {
  const viewer = useViewer();
  const start = useMutation(api.session_proofs.startVaultProof);
  const prove = useAction(api.session_proofs_node.proveVault);

  return useCallback(
    async (masterKey: CryptoKey) => {
      if (!viewer.encryptedIdentitySecretKey) {
        throw new Error("Identity key unavailable");
      }
      const identitySecretKey = await unwrapSecretUnderMasterKey(
        viewer.encryptedIdentitySecretKey,
        masterKey,
      );
      const { nonce } = await start();
      const signature = await signBytesAsync(
        identitySecretKey,
        vaultProofMessage(viewer._id, nonce),
      );
      const result = await prove({ signature });
      if (!result.success) throw new Error("Vault proof refused");
    },
    [viewer, start, prove],
  );
}
