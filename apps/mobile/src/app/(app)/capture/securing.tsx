import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/button";
import { IconBadge } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useOutbox } from "@/features/outbox/outbox-provider";
import { useI18n } from "@/providers/i18n-provider";
import { Screen } from "@/components/screen";

/** M07-4: visible encryption/upload progression, including offline success. */
export default function SecuringCapture() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { entries, progress, online, created, retry } = useOutbox();
  const entry = entries.find((candidate) => candidate.id === entryId);
  const itemId = created[entryId];

  useEffect(() => {
    if (!itemId) return;
    const timeout = setTimeout(() => {
      router.replace({ pathname: "/item/[id]", params: { id: itemId } });
    }, 650);
    return () => clearTimeout(timeout);
  }, [itemId, router]);

  const state = itemId
    ? "done"
    : entry?.status === "failed" || entry?.status === "quota"
      ? "failed"
      : !online
        ? "offline"
        : "working";
  const currentProgress = progress[entryId];
  const pct = currentProgress?.total
    ? Math.round((currentProgress.sent / currentProgress.total) * 100)
    : 0;

  return (
    <Screen center contentStyle={styles.content}>
      <IconBadge
        icon={
          state === "done"
            ? "check-circle"
            : state === "failed"
              ? "alert-circle"
              : "lock"
        }
        tone={
          state === "done" ? "success" : state === "failed" ? "danger" : "info"
        }
      />
      <Text variant="h1" align="center">
        {t(`capture.securing.${state}Title`)}
      </Text>
      <Text color="text.muted" align="center">
        {t(`capture.securing.${state}Body`, { pct })}
      </Text>
      {state === "failed" ? (
        <Button label={t("common.tryAgain")} onPress={retry} />
      ) : null}
      {state === "offline" ? (
        <Button
          label={t("capture.backHome")}
          variant="secondary"
          onPress={() => router.replace("/(app)/(tabs)/home")}
        />
      ) : null}
      <View />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", gap: 16 },
});
