import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { IconTile } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useOutbox } from "@/features/outbox/outbox-provider";
import { useVaultData } from "@/features/vault/vault-data";
import { formatBytes } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";

type StepState = "done" | "active" | "waiting" | "error";

/** M07-4 Securing your item: encrypt, upload, protected, in order. */
export default function SecuringCapture() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { entries, progress, online, created, retry } = useOutbox();
  const { pending } = useVaultData();
  const entry = entries.find((candidate) => candidate.id === entryId);
  const itemId = created[entryId];
  const pendingTitle = pending.find((p) => p.entry.id === entryId)?.title;
  const [seen, setSeen] = useState<{ title: string; bytes: number }>();

  if (entry && pendingTitle !== undefined && seen?.title !== pendingTitle) {
    setSeen({
      title: pendingTitle ?? t("capture.untitled"),
      bytes: entry.files.reduce((sum, file) => sum + file.bytes, 0),
    });
  }

  useEffect(() => {
    if (!itemId) return;
    const timeout = setTimeout(() => {
      router.replace({ pathname: "/item/[id]", params: { id: itemId } });
    }, 900);
    return () => clearTimeout(timeout);
  }, [itemId, router]);

  const current = progress[entryId];
  const ratio = itemId
    ? 1
    : current?.total
      ? Math.min(1, current.sent / current.total)
      : 0;
  const failed = entry?.status === "failed" || entry?.status === "quota";
  const upload: StepState = itemId ? "done" : failed ? "error" : "active";
  const uploadBody = itemId
    ? t("capture.securing.uploadedBody")
    : entry?.status === "quota"
      ? t("capture.securing.quotaBody")
      : failed
        ? t("capture.securing.failedBody")
        : !online
          ? t("capture.securing.offlineBody")
          : t("capture.securing.uploadingBody", {
              pct: Math.round(ratio * 100),
            });

  return (
    <Screen
      header={
        <NavBar
          title={t("capture.securing.title")}
          onBack={() => router.replace("/home")}
          right={<LanguageDropdown />}
        />
      }
      gap={20}
      footer={
        entry?.status === "quota" ? (
          <Button
            label={t("capture.securing.manageStorage")}
            onPress={() => router.replace("/settings")}
          />
        ) : failed ? (
          <Button label={t("common.tryAgain")} onPress={retry} />
        ) : !online && !itemId ? (
          <Button
            variant="secondary"
            label={t("capture.backHome")}
            onPress={() => router.replace("/home")}
          />
        ) : undefined
      }
    >
      <View style={styles.file}>
        <IconTile icon="document" size={48} background={colors["bg.warm"]} />
        <View style={styles.flex}>
          <Text variant="label" numberOfLines={1}>
            {seen?.title ?? t("capture.untitled")}
          </Text>
          {seen?.bytes ? (
            <Text variant="body-sm" color="text.muted">
              {formatBytes(seen.bytes)}
            </Text>
          ) : null}
        </View>
      </View>
      <Step
        state="done"
        title={t("capture.securing.encrypting")}
        body={t("capture.securing.encryptingBody")}
        ratio={1}
      />
      <Step
        state={upload}
        title={t("capture.securing.uploading")}
        body={uploadBody}
        ratio={ratio}
      />
      <Step
        state={itemId ? "done" : "waiting"}
        title={t("capture.securing.protected")}
        body={
          itemId
            ? t("capture.securing.protectedBody")
            : t("capture.securing.protectedWaiting")
        }
        ratio={itemId ? 1 : 0}
      />
    </Screen>
  );
}

function Step({
  state,
  title,
  body,
  ratio,
}: {
  state: StepState;
  title: string;
  body: string;
  ratio: number;
}) {
  const { colors } = useTheme();
  const ring =
    state === "done"
      ? colors["action.primary"]
      : state === "active"
        ? colors.accent
        : state === "error"
          ? colors["status.revoked"]
          : colors["border.strong"];
  return (
    <View style={styles.step}>
      <View
        style={[
          styles.dot,
          {
            borderColor: ring,
            backgroundColor: state === "done" ? ring : "transparent",
          },
        ]}
      >
        {state === "done" ? (
          <Icon name="check" size={14} color="text.inverse" />
        ) : state === "error" ? (
          <Icon name="alert-circle" size={14} color="status.revoked" />
        ) : null}
      </View>
      <View style={styles.flex}>
        <Text
          variant="label"
          color={state === "waiting" ? "text.muted" : "text.primary"}
        >
          {title}
        </Text>
        <Text
          variant="body-sm"
          color={state === "error" ? "status.revoked" : "text.muted"}
        >
          {body}
        </Text>
        <View
          style={[styles.track, { backgroundColor: colors["progress.track"] }]}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(ratio * 100)}%`,
                backgroundColor:
                  state === "error"
                    ? colors["status.revoked"]
                    : colors["progress.fill"],
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  file: { flexDirection: "row", alignItems: "center", gap: 14 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 6 },
  fill: { height: 6, borderRadius: 3 },
});
