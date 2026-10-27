import { useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import {
  CameraView,
  scanFromURLAsync,
  useCameraPermissions,
} from "expo-camera";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

import { Button } from "@/components/button";
import { BottomSheet } from "@/components/sheet";
import { Note } from "@/components/surfaces";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { toast } from "@/lib/toast";
import { useI18n } from "@/providers/i18n-provider";
import { colors as palette, radius } from "@/theme";
import { decodeKitQr } from "./kit-qr";

export function KitWordsField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (words: string) => void;
}) {
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const lastScan = useRef("");

  function accept(text: string): boolean {
    const words = decodeKitQr(text);
    if (!words) {
      toast({ variant: "error", title: t("kitScan.invalid") });
      return false;
    }
    onChangeText(words);
    return true;
  }

  async function openCamera() {
    if (!permission?.granted && permission?.canAskAgain !== false) {
      await requestPermission();
    }
    lastScan.current = "";
    setScanning(true);
  }

  async function fromImage() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (picked.canceled) return;
    const { uri } = picked.assets[0];
    try {
      const [code] = await scanFromURLAsync(uri, ["qr"]);
      if (code) accept(code.data);
      else toast({ variant: "error", title: t("kitScan.noQr") });
    } catch {
      toast({ variant: "error", title: t("kitScan.noQr") });
    } finally {
      const copy = new File(uri);
      if (copy.exists) copy.delete();
    }
  }

  return (
    <>
      <TextField
        label={t("oneWay.kit")}
        value={value}
        onChangeText={onChangeText}
        placeholder={t("recoveryKit.placeholder")}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
      />
      <View style={styles.actions}>
        <Button
          variant="secondary"
          icon="qr"
          label={t("kitScan.scan")}
          onPress={() => void openCamera()}
          style={styles.flex}
        />
        <Button
          variant="secondary"
          icon="image-gallery"
          label={t("kitScan.image")}
          onPress={() => void fromImage()}
          style={styles.flex}
        />
      </View>
      <Note icon="info" text={t("kitScan.paperHint")} />
      <BottomSheet
        visible={scanning}
        onDismiss={() => setScanning(false)}
        title={t("kitScan.title")}
      >
        {permission?.granted ? (
          <>
            <Text variant="body" color="text.muted">
              {t("kitScan.body")}
            </Text>
            <View style={styles.camera}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => {
                  if (data === lastScan.current) return;
                  lastScan.current = data;
                  if (accept(data)) setScanning(false);
                }}
              />
            </View>
          </>
        ) : (
          <>
            <Text variant="body" color="text.muted">
              {t("scan.cameraOffBody")}
            </Text>
            <Button
              label={t("common.openSettings")}
              onPress={() => void Linking.openSettings()}
            />
          </>
        )}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: 10 },
  camera: {
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: radius.lg,
    backgroundColor: palette.navy["700"],
  },
});
