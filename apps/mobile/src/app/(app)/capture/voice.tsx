import { memo, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { File } from "expo-file-system";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioRecorder,
} from "expo-audio";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { StateSheet } from "@/components/state-message";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { PermissionSheet } from "@/features/capture/add-sheet";
import { draftStore } from "@/features/capture/draft-store";
import { formatDuration } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";

const BARS = 32;
const RECORDING = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/**
 * M07-3 Voice note: records as soon as the microphone is allowed, shows
 * the time and a live level waveform, then hands the m4a to compose.
 *
 * Only `LiveSection` subscribes to the recorder state (several updates per
 * second); the screen frame, rings and callout render once.
 */
export default function VoiceNote() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const recorder = useAudioRecorder(RECORDING);
  const [denied, setDenied] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setDenied(true);
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
    })();
  }, [recorder]);

  return (
    <Screen
      header={
        <NavBar
          title={t("capture.voiceTitle")}
          onBack={router.back}
          right={<LanguageDropdown />}
        />
      }
      contentStyle={styles.content}
    >
      <View style={styles.mic}>
        <View
          style={[
            styles.ring,
            styles.r200,
            { backgroundColor: colors["accent.soft"] },
          ]}
        />
        <View
          style={[
            styles.ring,
            styles.r150,
            { backgroundColor: colors["progress.fill"], opacity: 0.18 },
          ]}
        />
        <View
          style={[
            styles.ring,
            styles.r100,
            { backgroundColor: colors["accent.text"] },
          ]}
        />
        <Icon name="mic" size={44} color="text.inverse" />
      </View>
      <LiveSection recorder={recorder} />
      <PermissionSheet
        problem={denied ? "microphone" : null}
        onDismiss={router.back}
      />
    </Screen>
  );
}

/** The part that re-renders with the recorder: time, waveform, controls. */
const LiveSection = memo(function LiveSection({
  recorder,
}: {
  recorder: AudioRecorder;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const state = useAudioRecorderState(recorder, 120);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.08));
  const [confirmReset, setConfirmReset] = useState(false);
  const [resumeAfter, setResumeAfter] = useState(false);

  // dBFS (-60..0) → bar height ratio, newest bar on the right.
  const metering = state.metering;
  useEffect(() => {
    if (!state.isRecording || metering === undefined) return;
    const level = Math.max(0.08, Math.min(1, (metering + 60) / 60));
    const frame = requestAnimationFrame(() => {
      setLevels((bars) => [...bars.slice(1), level]);
    });
    return () => cancelAnimationFrame(frame);
  }, [metering, state.isRecording]);

  async function save() {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    if (!recorder.uri) return;
    const durationSec = Math.round(state.durationMillis / 1000);
    draftStore.update({
      files: [
        {
          uri: recorder.uri,
          name: `${t("capture.voiceTitle")}.m4a`,
          mimeType: "audio/mp4",
          kind: "audio",
          durationSec,
        },
      ],
    });
    router.replace("/capture/compose");
  }

  function togglePause() {
    if (state.isRecording) recorder.pause();
    else recorder.record();
  }

  function askReset() {
    setResumeAfter(state.isRecording);
    if (state.isRecording) recorder.pause();
    setConfirmReset(true);
  }

  async function reset() {
    setConfirmReset(false);
    const previous = recorder.uri;
    await recorder.stop();
    if (previous) {
      const file = new File(previous);
      if (file.exists) file.delete();
    }
    setLevels(Array(BARS).fill(0.08));
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  function keep() {
    setConfirmReset(false);
    if (resumeAfter) recorder.record();
  }

  return (
    <>
      <Text variant="display" align="center">
        {formatDuration(state.durationMillis / 1000).padStart(5, "0")}
      </Text>
      <Text color="text.muted" align="center">
        {state.isRecording ? t("capture.recording") : t("capture.paused")}
      </Text>
      <View style={styles.wave}>
        {levels.map((level, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: Math.round(60 * level),
                backgroundColor: colors["progress.fill"],
              },
            ]}
          />
        ))}
      </View>
      <Callout icon="lock" text={t("capture.voiceEncrypted")} />
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          onPress={togglePause}
          style={styles.pause}
        >
          <View
            style={[
              styles.pauseButton,
              { backgroundColor: colors["accent.soft"] },
            ]}
          >
            <Icon name={state.isRecording ? "pause" : "mic"} />
          </View>
          <Text variant="caption">
            {state.isRecording ? t("capture.pause") : t("capture.resume")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={askReset}
          disabled={state.durationMillis < 500}
          style={styles.pause}
        >
          <View
            style={[
              styles.pauseButton,
              { backgroundColor: colors["accent.soft"] },
            ]}
          >
            <Icon name="rotate" />
          </View>
          <Text variant="caption">{t("capture.reset")}</Text>
        </Pressable>
        <Button
          label={t("capture.save")}
          onPress={save}
          disabled={state.durationMillis < 500}
          style={styles.flex}
        />
      </View>
      <StateSheet
        visible={confirmReset}
        onDismiss={keep}
        icon="rotate"
        tone="info"
        title={t("capture.resetTitle")}
        body={t("capture.resetBody", {
          time: formatDuration(state.durationMillis / 1000),
        })}
        primary={{
          label: t("capture.resetConfirm"),
          onPress: () => void reset(),
          variant: "danger",
        }}
        secondary={{
          label: t("capture.resetKeep"),
          onPress: keep,
          variant: "secondary",
        }}
      />
    </>
  );
});

const styles = StyleSheet.create({
  content: { alignItems: "stretch" },
  flex: { flex: 1 },
  mic: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: { position: "absolute" },
  r200: { width: 200, height: 200, borderRadius: 100 },
  r150: { width: 150, height: 150, borderRadius: 75 },
  r100: { width: 100, height: 100, borderRadius: 50 },
  wave: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bar: { width: 4, borderRadius: 2 },
  controls: { flexDirection: "row", alignItems: "center", gap: 16 },
  pause: { alignItems: "center", gap: 4 },
  pauseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
