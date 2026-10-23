import { useCallback } from "react";
import { useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Passkey, type PasskeyGetRequest } from "react-native-passkey";
import { api } from "@keeplas/backend/_generated/api";

/**
 * Sign in with a passkey synced to this phone (iCloud Keychain / Google
 * Password Manager): no WhatsApp code, so it still works after losing the
 * number. The session proves nothing else: restoring the vault from the
 * cloud still needs the number (session_proofs.ts).
 */
export function usePasskeySignIn() {
  const startAuthentication = useMutation(api.webauthn.startAuthentication);
  const { signIn } = useAuthActions();

  return useCallback(async () => {
    const options = await startAuthentication({});
    const credential = await Passkey.get(options as PasskeyGetRequest);
    await signIn("passkey", {
      response: {
        type: "public-key",
        clientExtensionResults: {},
        ...credential,
      } as never,
    });
  }, [startAuthentication, signIn]);
}
