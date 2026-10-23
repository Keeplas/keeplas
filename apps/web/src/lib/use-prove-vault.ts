import { useCallback } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { vaultProofMessage } from "@keeplas/backend/lib/vault_proof";
import { useRecipientCrypto } from "./use-recipient-crypto";

/**
 * Prove to the server that this session opened the vault: the identity key
 * (unwrapped with the MasterKey) signs a single-use nonce. Replacing a
 * verified phone number needs it on a session that never proved the number
 * (session_proofs.ts) — e.g. a browser linked by QR.
 */
export function useProveVault() {
  const viewer = useQuery(api.users.viewer);
  const { signWithIdentityKey } = useRecipientCrypto();
  const start = useMutation(api.session_proofs.startVaultProof);
  const prove = useAction(api.session_proofs_node.proveVault);

  return useCallback(async () => {
    if (!viewer) throw new Error("Viewer not loaded");
    const { nonce } = await start();
    const signature = await signWithIdentityKey(
      vaultProofMessage(viewer._id, nonce),
    );
    const result = await prove({ signature });
    if (!result.success) throw new Error("Vault proof refused");
  }, [viewer, start, prove, signWithIdentityKey]);
}
