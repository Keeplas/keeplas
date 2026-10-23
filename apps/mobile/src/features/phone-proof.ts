import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

/**
 * Restoring the cloud backup or asking contacts needs a WhatsApp code that
 * reached the account's number in this session (session_proofs.ts). A
 * phone sign-in already holds it; otherwise this opens /phone-proof, which
 * comes back here once the code is confirmed. Returns whether to go on.
 */
export function useEnsurePhoneProof(): () => boolean {
  const router = useRouter();
  const proofs = useQuery(api.session_proofs.getMine);
  const proven = proofs?.phone === true;
  return useCallback(() => {
    if (proven) return true;
    router.push("/phone-proof");
    return false;
  }, [proven, router]);
}
