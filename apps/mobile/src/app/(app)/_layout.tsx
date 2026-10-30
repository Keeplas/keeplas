import { useEffect, useRef } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { createPublicKeyMaterial } from "@/crypto/vault-keys";
import { AddSheetProvider } from "@/features/capture/add-sheet";
import { SecuringSheetProvider } from "@/features/capture/securing-sheet";
import { TabShell } from "@/features/navigation/tab-shell";
import { hasPendingLink } from "@/features/link/pending-link";
import { LifeCheckPrompt } from "@/features/life-check/life-check-prompt";
import { takePendingInvite } from "@/features/people/pending-invite";
import { useConfirmAvailability } from "@/features/people/use-confirm-availability";
import { PinGateProvider } from "@/features/pin/use-pin-gate";
import { useEnsureSocialRecovery } from "@/features/social-recovery";
import { useBackfillShares } from "@/features/vault/use-backfill-shares";
import { VaultDataProvider } from "@/features/vault/vault-data";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useEnsureDevice } from "@/lib/use-register-passkey";
import { usePushNotifications } from "@/lib/use-push-notifications";
import { useResumeOnUnlock } from "@/lib/use-resume-on-unlock";
import { useSession, useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

// A render error in the app keeps the session and the unlocked vault.
export { ErrorScreen as ErrorBoundary } from "@/components/error-screen";

/**
 * Signed-in, unlocked app. Besides the stack, it keeps three things true:
 * this phone is a registered device, the account has published its signed
 * ML-KEM key (as the web does lazily), and every new-device alert (M08-4),
 * pending pairing link and invitation opened while signed out is shown.
 */
export default function AppLayout() {
  const router = useRouter();
  const viewer = useViewer();
  const { settingUp } = useSession();
  const { masterKey } = useVault();
  const ensureDevice = useEnsureDevice();
  const setPublicKey = useAuditedMutation(api.users.setPublicKey);
  const alerts = useQuery(api.devices.pendingAlerts);
  const activeLifeCheck = useQuery(api.life_check.getActiveCycle);
  const pathname = usePathname();
  const shownAlerts = useRef(new Set<string>());
  const publishing = useRef(false);
  const registerPushToken = usePushNotifications();
  useResumeOnUnlock();

  useEffect(() => {
    ensureDevice(viewer._id)
      .then(registerPushToken)
      .catch(() => undefined); // Retried next launch.
  }, [ensureDevice, registerPushToken, viewer._id]);

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

  // A new account answers once setup is done, not in the middle of it.
  useEffect(() => {
    if (settingUp) return;
    const invite = takePendingInvite();
    if (invite) {
      router.push({ pathname: "/invite/[token]", params: { token: invite } });
    }
  }, [router, settingUp]);

  return (
    <PinGateProvider>
      <VaultDataProvider>
        <TrustUpkeep />
        <SecuringSheetProvider>
          <AddSheetProvider>
            <TabShell>
              <Stack screenOptions={{ headerShown: false }} />
            </TabShell>
          </AddSheetProvider>
        </SecuringSheetProvider>
        {activeLifeCheck && pathname !== "/life-check" ? (
          <LifeCheckPrompt
            missed={activeLifeCheck.status === "awaiting_confirmation"}
          />
        ) : null}
      </VaultDataProvider>
    </PinGateProvider>
  );
}

/**
 * Trusted-contact upkeep under VaultDataProvider, whose unlocked keys it
 * reuses: wrap my items to contacts who joined since, and confirm I am still
 * available to the people who chose me.
 */
function TrustUpkeep() {
  useBackfillShares();
  useConfirmAvailability();
  useEnsureSocialRecovery();
  return null;
}
