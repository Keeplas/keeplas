import { useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { StateMessage } from "@/components/state-message";
import { Text } from "@/components/text";
import type { FileMeta } from "@/crypto/item-meta";
import { formatDuration } from "@/lib/format";
import { contactSupport } from "@/lib/support";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";
import type { AttachmentState } from "./use-decrypted-attachment";

export function AttachmentPreview({
  meta,
  state,
  onRetry,
  onLock,
  onOpen,
}: {
  meta: FileMeta;
  state: AttachmentState;
  onRetry: () => void;
  onLock: () => void;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const frame = [styles.frame, { backgroundColor: colors["bg.subtle"] }];

  if (state.status === "loading") {
    return (
      <View style={[frame, styles.center]}>
        <ActivityIndicator color={colors["text.muted"]} />
        <Text variant="body-sm" color="text.muted">
          {t("item.opening")}
        </Text>
      </View>
    );
  }

  if (state.status === "error") {
    const { problem, reference } = state;
    const needsSupport = problem === "decrypt" || problem === "unknown";
    return (
      <View style={styles.error}>
        <StateMessage
          icon={problem === "offline" ? "globe" : "alert-triangle"}
          tone={problem === "offline" ? "info" : "warning"}
          title={t(`item.fileErrors.${problem}.title`)}
          body={t(`item.fileErrors.${problem}.body`)}
          primary={{ label: t("common.tryAgain"), onPress: onRetry }}
          secondary={
            problem === "decrypt"
              ? { label: t("item.lockVault"), onPress: onLock }
              : undefined
          }
        />
        {needsSupport ? (
          <>
            <Button
              variant="text"
              label={t("item.contactSupport")}
              onPress={() => void contactSupport(reference)}
            />
            <Text variant="caption" color="text.subtle" align="center">
              {t("item.reference", { ref: reference })}
            </Text>
          </>
        ) : null}
      </View>
    );
  }

  switch (meta.kind) {
    case "image":
      return (
        <View style={frame}>
          <Image
            source={{ uri: state.uri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={meta.name}
          />
        </View>
      );
    case "video":
      return <VideoPreview uri={state.uri} />;
    case "audio":
      return <AudioPreview uri={state.uri} durationSec={meta.durationSec} />;
    default:
      return (
        <View style={[frame, styles.center]}>
          <Icon name="document" size={40} color="text.muted" />
          <Text variant="label" align="center" numberOfLines={2}>
            {meta.name}
          </Text>
          <Button label={t("item.open")} onPress={onOpen} />
        </View>
      );
  }
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={styles.video}
    />
  );
}

function AudioPreview({
  uri,
  durationSec,
}: {
  uri: string;
  durationSec?: number;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const total = status.duration || durationSec || 0;

  useEffect(() => {
    if (status.didJustFinish) void player.seekTo(0);
  }, [status.didJustFinish, player]);

  async function toggle() {
    if (status.playing) return player.pause();
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
    });
    player.play();
  }

  return (
    <View style={[styles.audio, { backgroundColor: colors["bg.subtle"] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(status.playing ? "item.pause" : "item.play")}
        onPress={() => void toggle()}
        style={[styles.play, { backgroundColor: colors["action.primary"] }]}
      >
        <Icon
          name={status.playing ? "pause" : "play"}
          size={22}
          color="text.inverse"
        />
      </Pressable>
      <View style={styles.flex}>
        <View
          style={[styles.track, { backgroundColor: colors["progress.track"] }]}
        >
          <View
            style={[
              styles.fill,
              {
                backgroundColor: colors["progress.fill"],
                width: `${total ? Math.min(100, (status.currentTime / total) * 100) : 0}%`,
              },
            ]}
          />
        </View>
        <Text variant="caption" color="text.muted">
          {formatDuration(status.currentTime)} / {formatDuration(total)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    overflow: "hidden",
    minHeight: 220,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 20,
  },
  image: { width: "100%", height: 320 },
  video: { width: "100%", height: 240, borderRadius: radius.lg },
  error: { gap: 8 },
  audio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
  },
  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1, gap: 8 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6 },
});
