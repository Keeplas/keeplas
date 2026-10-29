import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { openSocialRecovery } from "@keeplas/crypto/social";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { ProgressBar } from "@/components/controls";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import { Callout, Card, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useEnsurePhoneProof } from "@/features/phone-proof";
import {
  clearRecoveryKey,
  createRecoveryKey,
  loadRecoveryKey,
  secureCodeStore,
  serialQueue,
  spacedCode,
  syncDeviceCodes,
  type CodeState,
} from "@/features/recovery-codes";
import { formatDate, formatTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useReplaceKit } from "@/lib/use-replace-kit";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";
import { useVault } from "@/providers/vault-provider";
import { colors as palette, radius } from "@/theme";

// The code exchange runs while contacts can still answer.
const EXCHANGING = ["pending", "approved_1"];

/** M02-1 / M02-2 / M02-4: start, monitor and finish 2-of-3 recovery. */
export default function ContactRecovery() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { colors } = useTheme();
  const viewer = useViewer();
  const request = useQuery(api.recovery.getMyRequest);
  const health = useQuery(api.recovery.getHealth);
  const start = useAuditedMutation(api.recovery.start);
  const cancel = useAuditedMutation(api.recovery.cancel);
  const commitCodes = useAuditedMutation(api.recovery.commitCodes);
  const revealCode = useAuditedMutation(api.recovery.revealCode);
  const releasePackage = useQuery(
    api.recovery.getReleasePackage,
    request?.status === "released" ? { requestId: request.requestId } : "skip",
  );
  const { adopt } = useVault();
  const { refreshDeviceVault } = useSession();
  const replaceKit = useReplaceKit();
  // Public half of the key this phone made (undefined while loading).
  const [deviceKey, setDeviceKey] = useState<string | null>();
  const [codes, setCodes] = useState<{
    requestId: string;
    byContact: Record<string, CodeState>;
  }>();
  const [queue] = useState(serialQueue);
  const [busy, setBusy] = useState(false);
  const ensurePhoneProof = useEnsurePhoneProof();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Reloaded when a request opens (it may have just been started here).
  const requestId = request?.requestId;
  useEffect(() => {
    void loadRecoveryKey(secureCodeStore, viewer._id).then((key) => {
      key?.secretKey.fill(0);
      setDeviceKey(key?.publicKey ?? null);
    });
  }, [viewer._id, requestId]);

  // Codes are computed from this phone's key only (never from the copy in
  // the request): a key swapped by Keeplas shows no code at all.
  const keyMatches = !!request && deviceKey === request.newDevicePublicKey;
  useEffect(() => {
    if (!request || !keyMatches || !EXCHANGING.includes(request.status)) {
      return;
    }
    void queue(() =>
      syncDeviceCodes({
        store: secureCodeStore,
        userId: viewer._id,
        publicKey: request.newDevicePublicKey,
        request,
        commit: (commitments) =>
          commitCodes({
            requestId: request.requestId,
            commitments: commitments as {
              contactId: Id<"trusted_contacts">;
              commitment: string;
            }[],
          }),
        reveal: (contactId, deviceNonce) =>
          revealCode({
            requestId: request.requestId,
            contactId: contactId as Id<"trusted_contacts">,
            deviceNonce,
          }),
      }),
    )
      .then((byContact) =>
        setCodes({ requestId: request.requestId, byContact }),
      )
      .catch(() => undefined); // Retried on the next update of the request.
  }, [request, keyMatches, queue, viewer._id, commitCodes, revealCode]);

  async function begin() {
    if (!ensurePhoneProof()) return;
    setBusy(true);
    try {
      const publicKey = await createRecoveryKey(secureCodeStore, viewer._id);
      setDeviceKey(publicKey);
      await start({ newDevicePublicKey: publicKey });
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!request || !releasePackage) return;
    setBusy(true);
    try {
      const key = await loadRecoveryKey(secureCodeStore, viewer._id);
      if (!key) throw new Error("Missing recovery key");
      if (releasePackage.newDevicePublicKey !== key.publicKey) {
        key.secretKey.fill(0);
        toast({ variant: "error", title: t("socialRecovery.keyMismatch") });
        return;
      }
      const masterKey = await openSocialRecovery({
        ownerUserId: viewer._id,
        generation: releasePackage.generation,
        requestId: request.requestId,
        devicePublicKey: key.publicKey,
        deviceSecretKey: key.secretKey,
        wrappedGateKey: releasePackage.wrappedGateKey,
        socialEnvelope: releasePackage.socialEnvelope,
        approvals: releasePackage.approvals,
      }).finally(() => key.secretKey.fill(0));
      // The old words may be what was lost: new ones (never shown) give
      // this phone a RootKey, so the cloud backup is sealed again.
      await replaceKit(viewer._id, masterKey);
      await adopt(masterKey.slice());
      masterKey.fill(0);
      await clearRecoveryKey(secureCodeStore, viewer._id);
      refreshDeviceVault();
      router.replace("/vault-restored");
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(false);
    }
  }

  const closed =
    !request ||
    ["cancelled", "expired", "rejected", "rotated"].includes(request.status);
  // Why this phone shows no codes: it did not start the request, or the
  // request no longer carries the key it made.
  const keyProblem =
    closed || deviceKey === undefined || keyMatches
      ? null
      : deviceKey === null
        ? "otherPhone"
        : "keyMismatch";
  const shown: Record<string, CodeState> =
    (codes?.requestId === request?.requestId && codes?.byContact) || {};
  const tampered = Object.values(shown).some((c) => c.kind === "mismatch");
  const codeOf = (contactId: string) => {
    const state = shown[contactId];
    return state?.kind === "ready" ? state.code : null;
  };
  const notReady = closed && health?.trustContacts.configured === false;
  const approvals =
    request?.contacts.filter((contact) => contact.decision === "approve")
      .length ?? 0;
  const rejected = request?.contacts.find(
    (contact) => contact.decision === "reject",
  );
  const windowLeft = request ? Math.max(0, request.windowEndsAt - now) : 0;
  const windowTotal = request ? request.windowEndsAt - request.createdAt : 1;

  return (
    <Screen
      header={
        <AppHeader onBack={router.canGoBack() ? router.back : undefined} />
      }
      gap={14}
      footer={
        notReady ? (
          <Button
            label={t("socialRecovery.useKit")}
            onPress={() => router.replace("/recovery-kit")}
          />
        ) : closed ? (
          <Button
            label={t("socialRecovery.start")}
            onPress={() => void begin()}
            loading={busy}
          />
        ) : request.status === "released" ? (
          <Button
            label={t("socialRecovery.restore")}
            onPress={() => void finish()}
            loading={busy}
          />
        ) : (
          <Button
            variant="danger"
            label={t("socialRecovery.cancel")}
            onPress={() =>
              cancel({}).catch(() =>
                toast({ variant: "error", title: t("common.genericError") }),
              )
            }
          />
        )
      }
    >
      {closed ? (
        <>
          <Text variant="h1">{t("socialRecovery.title")}</Text>
          <Text variant="body-lg" color="text.muted">
            {t("socialRecovery.body")}
          </Text>
          {notReady ? (
            <Callout
              tone="warning"
              icon="people"
              text={t("socialRecovery.notReady")}
            />
          ) : request?.status === "expired" ? (
            <Callout
              tone="warning"
              icon="clock"
              text={t("socialRecovery.expired")}
            />
          ) : request?.status === "rejected" ? (
            <Callout
              tone="danger"
              icon="alert-triangle"
              text={t("socialRecovery.rejected", {
                name: rejected?.name || t("recoveryCenter.owner"),
              })}
            />
          ) : null}
        </>
      ) : (
        <>
          <Text variant="h1">{t("socialRecovery.requestTitle")}</Text>
          <Text variant="body-lg" color="text.muted">
            {t("socialRecovery.requestBody")}
          </Text>
          <Card>
            <Text variant="label">
              {t("socialRecovery.approvals", { n: Math.min(approvals, 2) })}
            </Text>
            <ProgressBar value={Math.min(approvals, 2) / 2} />
            <Text variant="body-sm" color="text.muted">
              {approvals >= 2
                ? t("socialRecovery.approvalsDone")
                : t("socialRecovery.approvalsLeft", { n: 2 - approvals })}
            </Text>
          </Card>
          <Card>
            {request.contacts.map((contact, index) => (
              <View key={contact.contactId} style={styles.contact}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor:
                        AVATAR_COLORS[index % AVATAR_COLORS.length],
                    },
                  ]}
                >
                  <Text variant="label" color="text.inverse">
                    {(contact.name || "?").trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text variant="label">{contact.name}</Text>
                  {contact.decidedAt ? (
                    <Text variant="body-sm" color="text.muted">
                      {`${formatDate(contact.decidedAt, language)} · ${formatTime(contact.decidedAt, language)}`}
                    </Text>
                  ) : codeOf(contact.contactId) ? (
                    <Text variant="digit">
                      {spacedCode(codeOf(contact.contactId)!)}
                    </Text>
                  ) : keyMatches && !tampered ? (
                    <Text variant="body-sm" color="text.muted">
                      {t("socialRecovery.codeWaiting", { name: contact.name })}
                    </Text>
                  ) : null}
                </View>
                <StatusChip
                  label={
                    contact.decision === "approve"
                      ? t("socialRecovery.approved")
                      : contact.decision === "reject"
                        ? t("socialRecovery.declined")
                        : t("socialRecovery.waiting")
                  }
                  tone={
                    contact.decision === "approve"
                      ? "success"
                      : contact.decision === "reject"
                        ? "danger"
                        : "warning"
                  }
                />
              </View>
            ))}
          </Card>
          <View style={[styles.window, { backgroundColor: colors["bg.info"] }]}>
            <View style={styles.contact}>
              <Icon name="clock" size={22} color="text.primary" />
              <View style={styles.flex}>
                <Text variant="label">{t("socialRecovery.windowTitle")}</Text>
                <Text variant="body-sm" color="text.muted">
                  {t("socialRecovery.windowStarted")}
                </Text>
              </View>
            </View>
            <Text variant="h2">
              {windowLeft > 0
                ? t("socialRecovery.hoursLeft", {
                    n: Math.ceil(windowLeft / 3_600_000),
                  })
                : t("socialRecovery.windowOver")}
            </Text>
            <ProgressBar value={1 - windowLeft / windowTotal} />
            <Text variant="body-sm" color="text.muted">
              {t("socialRecovery.windowBody")}
            </Text>
          </View>
          {EXCHANGING.includes(request.status) ? (
            keyProblem ? (
              <Callout
                tone={keyProblem === "otherPhone" ? "warning" : "danger"}
                icon="alert-triangle"
                text={t(`socialRecovery.${keyProblem}`)}
              />
            ) : tampered ? (
              <Callout
                tone="danger"
                icon="alert-triangle"
                text={t("socialRecovery.codeTampered")}
              />
            ) : (
              <Callout icon="phone" text={t("socialRecovery.codeBody")} />
            )
          ) : null}
        </>
      )}
    </Screen>
  );
}

const AVATAR_COLORS = Object.values(palette.category);

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  contact: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  window: { gap: 10, padding: 16, borderRadius: radius.md },
});
