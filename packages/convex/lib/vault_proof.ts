/**
 * Bytes the owner's ML-DSA identity key signs to prove, in one session, that
 * this client opened the vault (the identity secret is wrapped under the
 * MasterKey). Shared by the server (session_proofs.proveVault) and the
 * clients. The fixed prefix keeps the signature useless anywhere else.
 */
export function vaultProofMessage(userId: string, nonce: string): Uint8Array {
  return new TextEncoder().encode(
    `keeplas/session-vault-proof/v1|${userId}|${nonce}`,
  );
}
