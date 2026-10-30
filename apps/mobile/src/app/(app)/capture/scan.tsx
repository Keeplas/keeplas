import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";

import { Icon } from "@/components/icon";
import { StateSheet } from "@/components/state-message";
import { Text } from "@/components/text";
import { draftStore, useDraft } from "@/features/capture/draft-store";
import { chooseFiles, chooseFromLibrary } from "@/features/capture/media";
import { toast } from "@/lib/toast";
import { useCameraAccess } from "@/lib/use-camera-access";
import { useI18n } from "@/providers/i18n-provider";
import { colors as palette, radius, type } from "@/theme";
import { keepUnlockedWhile } from "@/lib/auto-lock";
import { draftHref, useDraftParam } from "@/features/capture/draft-route";

/**
 * M07-2 Scan document. "Auto" opens the system document scanner (VisionKit /
 * ML Kit: edges, perspective, several pages); "Manual" is the dark camera
 * below, where each shot adds a page. Pages are bound into one PDF on save
 * (M07-8). The gallery button adds photos or files instead, also while
 * the camera is off.
 */
export default function ScanDocument() {
  useDraftParam();
  const router = useRouter();
  const { t } = useI18n();
  const draft = useDraft();
  const camera = useRef<CameraView>(null);
  const access = useCameraAccess();
  const [cameraOffDismissed, setCameraOffDismissed] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const launched = useRef(false);

  const review = () => router.replace(draftHref("/capture/compose"));

  async function scanAuto() {
    setMode("auto");
    try {
      const scanner = await import("react-native-document-scanner-plugin");
      const result = await keepUnlockedWhile(() =>
        scanner.default.scanDocument({
          croppedImageQuality: 85,
          responseType: scanner.ResponseType.ImageFilePath,
        }),
      );
      const scanned = result.scannedImages ?? [];
      if (
        result.status === scanner.ScanDocumentResponseStatus.Success &&
        scanned.length > 0
      ) {
        draftStore.addPages(
          scanned.map((uri) => (uri.startsWith("/") ? `file://${uri}` : uri)),
        );
        review();
        return;
      }
    } catch {
      toast({
        variant: "info",
        title: t("capture.autoUnavailableTitle"),
        description: t("capture.autoUnavailableBody"),
      });
    }
    setMode("manual");
  }

  useEffect(() => {
    if (!access.granted || launched.current) return;
    launched.current = true;
    void scanAuto();
  });

  async function shoot() {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8 });
      if (photo) draftStore.addPages([photo.uri]);
    } finally {
      setBusy(false);
    }
  }

  function addFromLibrary() {
    Alert.alert(t("capture.document"), undefined, [
      {
        text: t("capture.chooseLibrary"),
        onPress: async () => {
          const files = await chooseFromLibrary();
          if (files.length) draftStore.addPages(files.map((f) => f.uri));
        },
      },
      {
        text: t("capture.chooseFile"),
        onPress: async () => {
          const files = await chooseFiles();
          if (!files.length) return;
          draftStore.update({ kind: "file", pages: [] });
          draftStore.addFiles(files);
          review();
        },
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }

  const pages = draft.pages.length;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={router.back}
          hitSlop={12}
        >
          <Icon name="chevron-left" tint={palette.white} />
        </Pressable>
        <Text variant="label" style={styles.white}>
          {t("capture.scanTitle")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("capture.flash")}
          accessibilityState={{ selected: torch }}
          onPress={() => setTorch((on) => !on)}
          hitSlop={12}
        >
          <Icon
            name="flash"
            size={22}
            tint={torch ? palette.dawn["500"] : palette.white}
          />
        </Pressable>
      </View>
      <View style={styles.modes}>
        {(["auto", "manual"] as const).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === option }}
            onPress={() =>
              option === "auto" ? void scanAuto() : setMode("manual")
            }
            style={[styles.mode, mode === option && styles.modeActive]}
          >
            <Text
              style={[
                type.caption,
                mode === option ? styles.navy : styles.white,
              ]}
            >
              {t(option === "auto" ? "capture.modeAuto" : "capture.modeManual")}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.camera}>
        {access.granted && mode === "manual" ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
          />
        ) : null}
        <View pointerEvents="none" style={styles.frame}>
          {(["tl", "tr", "bl", "br"] as const).map((corner) => (
            <View key={corner} style={[styles.corner, styles[corner]]} />
          ))}
        </View>
        <View style={styles.banner}>
          <Icon name="lock" tint={palette.white} />
          <View style={styles.bannerText}>
            <Text variant="label" style={styles.white}>
              {t("capture.encryptedTitle")}
            </Text>
            <Text variant="body-sm" style={{ color: palette.navy["200"] }}>
              {t("capture.scanEncryptedBody")}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("capture.gallery")}
          onPress={addFromLibrary}
          style={styles.gallery}
        >
          <Icon name="image-gallery" size={22} tint={palette.white} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("capture.shutter")}
          // While the camera is off, the shutter says why and how to fix it.
          onPress={access.denied ? () => setCameraOffDismissed(false) : shoot}
          disabled={
            !access.denied && (!access.granted || busy || mode !== "manual")
          }
          style={styles.shutter}
        >
          <View style={styles.shutterDot} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={review}
          disabled={pages === 0}
          style={[styles.done, { opacity: pages === 0 ? 0.4 : 1 }]}
        >
          <Text style={[type.caption, styles.navy]}>
            {t("capture.pages", { count: pages })}
          </Text>
          <Icon name="arrow-right" size={16} tint={palette.navy["900"]} />
        </Pressable>
      </View>
      <StateSheet
        visible={access.denied && !cameraOffDismissed}
        onDismiss={() => setCameraOffDismissed(true)}
        icon="camera"
        tone="neutral"
        title={t("permissions.cameraTitle")}
        body={t("permissions.cameraBody")}
        primary={access.allow}
        secondary={{
          label: t("common.notNow"),
          onPress: () => setCameraOffDismissed(true),
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.navy["950"] },
  white: { color: palette.white },
  navy: { color: palette.navy["900"] },
  top: {
    height: 40,
    marginTop: 5,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modes: {
    flexDirection: "row",
    alignSelf: "center",
    gap: 4,
    padding: 4,
    marginTop: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.navy["800"],
  },
  mode: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  modeActive: { backgroundColor: palette.white },
  camera: {
    // Shrinks on short screens (iPhone SE: 667 pt) so the controls below
    // keep their room.
    height: 520,
    flexShrink: 1,
    marginTop: 8,
    backgroundColor: palette.navy["700"],
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  frame: {
    position: "absolute",
    top: 36,
    left: 36,
    right: 36,
    bottom: 140,
    borderWidth: 1.5,
    borderColor: palette.sky["500"],
    borderRadius: 4,
  },
  corner: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.sky["500"],
    backgroundColor: palette.white,
  },
  tl: { top: -7, left: -7 },
  tr: { top: -7, right: -7 },
  bl: { bottom: -7, left: -7 },
  br: { bottom: -7, right: -7 },
  banner: {
    margin: 20,
    marginBottom: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: palette.navy["900"],
  },
  bannerText: { flex: 1, gap: 2 },
  controls: {
    flex: 1,
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
  },
  gallery: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.navy["800"],
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: palette.white,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterDot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.white,
  },
  done: {
    minWidth: 96,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
  },
});
