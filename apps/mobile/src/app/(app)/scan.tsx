import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  pairingCode,
  pairingKeyHash,
  type PairingQr,
} from "@keeplas/crypto/pairing";

import { AppHeader } from "@/components/app-header";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import { StateMessage, StateSheet } from "@/components/state-message";
import { Text } from "@/components/text";
import { draftStore } from "@/features/capture/draft-store";
import { claimCaptureQr } from "@/features/link/capture-qr";
import { PairingApproval } from "@/features/link/pairing-approval";
import { takePendingLink } from "@/features/link/pending-link";
import {
  evaluatePairingQr,
  type PairingSession,
} from "@/features/link/qr-flow";
import {
  PairingKeyMismatch,
  PresenceDeclined,
  useApprovePairing,
} from "@/features/link/use-approve-pairing";
import { env } from "@/lib/env";
import { useCameraAccess } from "@/lib/use-camera-access";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { colors as palette, radius } from "@/theme";
import { draftHref } from "@/features/capture/draft-route";

/**
 * M03-4 Scan the QR code. A web "Scan with my phone" code (W06-7) opens the
 * document scanner; any other scan (or universal link) goes through
 * `evaluatePairingQr`: invalid QR, expired session, key mismatch (M09-3,
 * reported to Convex) or M03-5, where only an explicit Approve (then the
 * biometric prompt) logs the browser in. A link never approves on its own.
 */
export default function Scan() {
  const router = useRouter();
  const convex = useConvex();
  const { t } = useI18n();
  const { colors } = useTheme();
  const camera = useCameraAccess();
  const reject = useAuditedMutation(api.pairing.reject);
  const claimHandoff = useAuditedMutation(api.capture_handoffs.claim);
  const [torch, setTorch] = useState(false);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<
    "invalid" | "expired" | "failed" | null
  >(null);
  // M03-5: a checked pairing QR waiting for Approve or Decline.
  const [pending, setPending] = useState<{
    qr: PairingQr;
    session: PairingSession;
    code: string;
  } | null>(null);
  const [approving, setApproving] = useState(false);
  const approvePairing = useApprovePairing();
  const busy = useRef(false);

  const handle = useCallback(
    async (text: string) => {
      if (busy.current) return;
      busy.current = true;
      setChecking(true);
      try {
        // W06-7: a browser waits for a scan from this phone.
        const capture = await claimCaptureQr(text, {
          claim: (handoffId) => claimHandoff({ handoffId }),
          expectedOrigin: env.appUrl,
        });
        if (capture.kind === "invalid" || capture.kind === "expired") {
          setProblem(capture.kind);
          return;
        }
        if (capture.kind === "ok") {
          draftStore.start("scan", { handoffId: capture.handoffId });
          router.replace(draftHref("/capture/scan"));
          return;
        }
        const outcome = await evaluatePairingQr(text, {
          getSession: (sessionId) =>
            convex.query(api.pairing.get, {
              sessionId: sessionId as Id<"pairing_sessions">,
            }),
          keyHash: pairingKeyHash,
          expectedOrigin: env.appUrl,
        });
        if (outcome.kind === "invalid" || outcome.kind === "expired") {
          setProblem(outcome.kind);
          return;
        }
        const { qr } = outcome;
        if (outcome.kind === "mismatch") {
          await reject({
            sessionId: qr.sessionId as Id<"pairing_sessions">,
            reason: "key_mismatch",
          }).catch(() => undefined); // The block below matters more than the report.
          router.replace({
            pathname: "/link-blocked",
            params: { expected: qr.keyHash, received: outcome.receivedHash },
          });
          return;
        }
        setPending({
          qr,
          session: outcome.session,
          code: await pairingCode(qr),
        });
      } finally {
        busy.current = false;
        setChecking(false);
      }
    },
    [convex, reject, claimHandoff, router],
  );

  async function approve() {
    if (!pending) return;
    const { qr, session } = pending;
    setApproving(true);
    try {
      await approvePairing(qr, session.browserPublicKey);
    } catch (error) {
      if (error instanceof PairingKeyMismatch) {
        await reject({
          sessionId: qr.sessionId as Id<"pairing_sessions">,
          reason: "key_mismatch",
        }).catch(() => undefined);
        router.replace({
          pathname: "/link-blocked",
          params: { expected: qr.keyHash, received: error.receivedHash },
        });
      } else if (!(error instanceof PresenceDeclined)) {
        setPending(null);
        setProblem("failed");
      }
      return;
    } finally {
      setApproving(false);
    }
    router.replace({
      pathname: "/link-connected",
      params: {
        ua: session.userAgent,
        country: session.approxLocation,
        at: String(Date.now()),
      },
    });
  }

  async function decline() {
    if (!pending) return;
    await reject({
      sessionId: pending.qr.sessionId as Id<"pairing_sessions">,
      reason: "declined",
    }).catch(() => undefined); // The session expires in 2 minutes anyway.
    router.back();
  }

  useEffect(() => {
    const link = takePendingLink();
    if (link) void handle(link);
  }, [handle]);

  const header = <AppHeader onBack={router.back} />;

  if (pending) {
    return (
      <PairingApproval
        sessionId={pending.qr.sessionId}
        session={pending.session}
        code={pending.code}
        busy={approving}
        onApprove={() => void approve()}
        onDecline={() => void decline()}
        onClose={() => setPending(null)}
      />
    );
  }

  if (camera.denied) {
    return (
      <Screen header={header}>
        <StateMessage
          icon="camera"
          tone="neutral"
          title={t("scan.cameraOffTitle")}
          body={t("scan.cameraOffBody")}
          primary={camera.allow}
          secondary={{ label: t("common.notNow"), onPress: router.back }}
        />
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <Text variant="h1">{t("scan.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("scan.body")}
      </Text>
      <View style={[styles.camera, { backgroundColor: palette.navy["700"] }]}>
        {camera.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={
              checking || problem ? undefined : ({ data }) => handle(data)
            }
          />
        ) : null}
        <Viewfinder />
        {checking ? (
          <View style={styles.checking}>
            <ActivityIndicator color={palette.white} />
            <Text variant="body-sm" style={{ color: palette.white }}>
              {t("scan.checking")}
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("capture.flash")}
          accessibilityState={{ selected: torch }}
          onPress={() => setTorch((on) => !on)}
          style={[styles.round, styles.flash]}
        >
          <Icon name="flash" size={22} tint={palette.white} />
        </Pressable>
      </View>
      {camera.granted ? (
        <View style={[styles.allowed, { backgroundColor: colors["bg.info"] }]}>
          <Icon name="camera" size={18} />
          <Text variant="body-sm">{t("scan.cameraAllowed")}</Text>
          <Icon name="check-circle" size={18} color="accent" />
        </View>
      ) : null}
      <StateSheet
        visible={problem !== null}
        onDismiss={() => setProblem(null)}
        icon={problem === "invalid" ? "qr" : "clock"}
        tone={problem === "invalid" ? "danger" : "warning"}
        title={t(`scan.${problem ?? "invalid"}Title`)}
        body={t(`scan.${problem ?? "invalid"}Body`)}
        primary={{
          label: t("scan.scanAgain"),
          onPress: () => setProblem(null),
        }}
      />
    </Screen>
  );
}

/** Four white corner brackets around a 200 pt square (Figma viewfinder). */
function Viewfinder() {
  return (
    <View pointerEvents="none" style={styles.viewfinder}>
      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
        <View key={corner} style={[styles.corner, cornerStyle[corner]]} />
      ))}
    </View>
  );
}

const CORNER = { width: 44, height: 44, borderColor: palette.white };
const cornerStyle = StyleSheet.create({
  tl: {
    ...CORNER,
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  tr: {
    ...CORNER,
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bl: {
    ...CORNER,
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  br: {
    ...CORNER,
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
});

const styles = StyleSheet.create({
  camera: {
    height: 330,
    borderRadius: radius.lg,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  viewfinder: { width: 200, height: 200, marginTop: -40 },
  corner: { position: "absolute" },
  checking: {
    position: "absolute",
    alignItems: "center",
    gap: 8,
  },
  round: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7, 26, 48, 0.85)",
  },
  flash: { left: 20, bottom: 20 },
  allowed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
});
