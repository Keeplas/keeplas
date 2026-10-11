import { useEffect, useRef } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { createPublicKeyMaterial } from "@/crypto/vault-keys";
import { StateSheet } from "@/components/state-message";
import { hasPendingLink } from "@/features/link/pending-link";
import { VaultDataProvider } from "@/features/vault/vault-data";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useEnsureDevice } from "@/lib/use-register-passkey";
import { usePushNotifications } from "@/lib/use-push-notifications";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

/**
 * Signed-in, unlocked app. Besides the stack, it keeps three things true:
 * this phone is a registered device, the account has published its signed
 * ML-KEM key (as the web does lazily), and every new-device alert (M08-4)
 * and pending pairing link is shown.
 */
export default function AppLayout() {
  const router = useRouter();
  const viewer = useViewer();
  const { masterKey } = useVault();
  const ensureDevice = useEnsureDevice();
  const setPublicKey = useAuditedMutation(api.users.setPublicKey);
  const alerts = useQuery(api.devices.pendingAlerts);
  const activeLifeCheck = useQuery(api.life_check.getActiveCycle);
  const validateLifeCheck = useAuditedMutation(api.life_check.validateCycle);
  const postponeLifeCheck = useAuditedMutation(api.life_check.postponeCycle);
  const pathname = usePathname();
  const shownAlerts = useRef(new Set<string>());
  const publishing = useRef(false);
  usePushNotifications(viewer._id);

  useEffect(() => {
    ensureDevice(viewer._id).catch(() => undefined); // Retried next launch.
  }, [ensureDevice, viewer._id]);

  useEffect(() => {
    if (viewer.publicKey || !masterKey || publishing.current) return;
    publishing.current = true;
    createPublicKeyMaterial(masterKey)
      .then(({ publicKeys }) => setPublicKey(publicKeys))
      .catch(() => {
        publishing.current = false;
      });
  }, [viewer.publicKey, masterKey, setPublicKey]);

  useEffect(() => {
    const next = alerts?.find((d) => !shownAlerts.current.has(d._id));
    if (!next) return;
    shownAlerts.current.add(next._id);
    router.push({ pathname: "/new-device", params: { id: next._id } });
  }, [alerts, router]);

  useEffect(() => {
    if (hasPendingLink()) router.push("/scan");
  }, [router]);

  return (
    <VaultDataProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StateSheet
        visible={!!activeLifeCheck && pathname !== "/life-check"}
        onDismiss={() => undefined}
        icon="shield-check"
        tone="info"
        title="Life check"
        body="Let us know you're okay. This resets the safety countdown."
        primary={{
          label: "I'm okay",
          onPress: () => void validateLifeCheck({ method: "tap" }),
        }}
        secondary={{
          label: "Remind me in 48 hours",
          onPress: () => void postponeLifeCheck({ duration: "48h" }),
        }}
      />
    </VaultDataProvider>
  );
}
