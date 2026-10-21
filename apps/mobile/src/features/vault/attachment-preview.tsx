import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { File } from "expo-file-system";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import Pdf from "react-native-pdf";
import { WebView } from "react-native-webview";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { StateMessage } from "@/components/state-message";
import { Text } from "@/components/text";
import type { FileMeta } from "@/crypto/item-meta";
import { formatDuration } from "@/lib/format";
import { contactSupport } from "@/lib/support";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, withAlpha } from "@/theme";
import { documentKind, previewableOffice } from "./document-kind";
import { officePage, sheetToHtml, wordToHtml } from "./office-html";
import type { AttachmentState } from "./use-decrypted-attachment";

export interface PreviewFile {
  id: string;
  meta: FileMeta;
  state: AttachmentState;
}

interface Handlers {
  onRetry: (id: string) => void;
  onLock: () => void;
  onShare: () => void;
}

export function AttachmentPreview({
  file,
  onPages,
  ...handlers
}: Handlers & {
  file: PreviewFile;
  onPages: (pages: number) => void;
}) {
  const { colors } = useTheme();
  const card = [styles.card, { backgroundColor: colors["bg.subtle"] }];
  const { meta, state } = file;

  if (state.status !== "ready") {
    return (
      <View style={[card, styles.center]}>
        <PreviewStatus file={file} {...handlers} />
      </View>
    );
  }
  switch (meta.kind) {
    case "video":
      return <VideoPreview uri={state.uri} />;
    case "audio":
      return <AudioPreview uri={state.uri} durationSec={meta.durationSec} />;
    case "image":
      return null;
    default:
      return (
        <View style={card}>
          <DocumentPreview
            uri={state.uri}
            meta={meta}
            onPages={onPages}
            onShare={handlers.onShare}
          />
        </View>
      );
  }
}

function PreviewStatus({
  file,
  onRetry,
  onLock,
  dark = false,
}: Handlers & { file: PreviewFile; dark?: boolean }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { state } = file;

  if (state.status === "loading") {
    return (
      <View style={styles.status}>
        <ActivityIndicator
          color={dark ? colors["text.inverse"] : colors["text.muted"]}
        />
        <Text variant="body-sm" color={dark ? "text.inverse" : "text.muted"}>
          {state.progress !== undefined && state.progress < 1
            ? t("item.downloading", { pct: Math.floor(state.progress * 100) })
            : t("item.opening")}
        </Text>
      </View>
    );
  }
  if (state.status !== "error") return null;
  const { problem, reference } = state;
  const needsSupport = problem === "decrypt" || problem === "unknown";
  return (
    <View
      style={[
        styles.status,
        dark && [styles.errorOnDark, { backgroundColor: colors["bg.surface"] }],
      ]}
    >
      <StateMessage
        icon={problem === "offline" ? "globe" : "alert-triangle"}
        tone={problem === "offline" ? "info" : "warning"}
        title={t(`item.fileErrors.${problem}.title`)}
        body={t(`item.fileErrors.${problem}.body`)}
        primary={{
          label: t("common.tryAgain"),
          onPress: () => onRetry(file.id),
        }}
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

export function PhotoGallery({
  photos,
  selected,
  onSelect,
  ...handlers
}: Handlers & {
  photos: PreviewFile[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [turns, setTurns] = useState<Record<string, number>>({});
  const photo = photos[selected];
  const turn = turns[photo.id] ?? 0;

  return (
    <View style={[styles.gallery, { backgroundColor: colors["bg.header"] }]}>
      <View style={styles.photo}>
        {photo.state.status === "ready" ? (
          <Image
            source={{ uri: photo.state.uri }}
            resizeMode="contain"
            accessibilityLabel={photo.meta.name}
            style={[
              styles.photoImage,
              { transform: [{ rotate: `${turn * 90}deg` }] },
            ]}
          />
        ) : (
          <PreviewStatus file={photo} dark {...handlers} />
        )}
      </View>
      <View style={styles.photoBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.flex}
          contentContainerStyle={styles.thumbs}
        >
          {photos.map((item, index) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.meta.name}
              accessibilityState={{ selected: index === selected }}
              onPress={() => onSelect(index)}
              style={[
                styles.thumb,
                { backgroundColor: withAlpha(colors["text.inverse"], 0.12) },
                index === selected && {
                  borderWidth: 2,
                  borderColor: colors["text.inverse"],
                },
              ]}
            >
              {item.state.status === "ready" ? (
                <Image
                  source={{ uri: item.state.uri }}
                  style={styles.thumbImage}
                />
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
        <Text variant="caption" color="text.inverse">
          {t("item.page", { current: selected + 1, total: photos.length })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("item.rotate")}
          hitSlop={10}
          onPress={() =>
            setTurns((current) => ({ ...current, [photo.id]: (turn + 1) % 4 }))
          }
        >
          <Icon name="rotate" size={18} color="text.inverse" />
        </Pressable>
      </View>
    </View>
  );
}

function DocumentPreview({
  uri,
  meta,
  onPages,
  onShare,
}: {
  uri: string;
  meta: FileMeta;
  onPages: (pages: number) => void;
  onShare: () => void;
}) {
  const { t } = useI18n();
  switch (documentKind(meta.name, meta.mimeType)) {
    case "pdf":
      return (
        <PdfPreview
          uri={uri}
          name={meta.name}
          onPages={onPages}
          onShare={onShare}
        />
      );
    case "text":
      return <TextPreview uri={uri} />;
    case "office":
      return <OfficePreview uri={uri} meta={meta} onShare={onShare} />;
    default:
      return (
        <View style={[styles.page, styles.center]}>
          <Icon name="document" size={40} color="text.muted" />
          <Text variant="label" align="center" numberOfLines={2}>
            {meta.name}
          </Text>
          <Text variant="body-sm" color="text.muted" align="center">
            {t("item.noPreview", {
              type: meta.name.split(".").pop()?.toUpperCase() ?? "",
            })}
          </Text>
        </View>
      );
  }
}

function OfficePreview({
  uri,
  meta,
  onShare,
}: {
  uri: string;
  meta: FileMeta;
  onShare: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const native = Platform.OS === "ios";
  const convert = native
    ? null
    : previewableOffice(meta.name, new File(uri).size);
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(!native && convert === null);

  useEffect(() => {
    if (native || !convert) return;
    let alive = true;
    void (async () => {
      try {
        const bytes = await new File(uri).bytes();
        const body =
          convert === "word"
            ? await wordToHtml(bytes)
            : await sheetToHtml(bytes);
        if (alive) {
          setHtml(
            officePage(body, {
              text: colors["text.primary"],
              border: colors["border.default"],
            }),
          );
        }
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uri, native, convert, colors]);

  if (failed) {
    return (
      <View style={[styles.page, styles.center]}>
        <StateMessage
          icon="document"
          tone="info"
          title={meta.name}
          body={t("item.noPreview", {
            type: meta.name.split(".").pop()?.toUpperCase() ?? "",
          })}
          primary={{ label: t("item.download"), onPress: onShare }}
        />
      </View>
    );
  }

  if (!native && !html) {
    return (
      <View style={[styles.office, styles.center]}>
        <Text variant="body-sm" color="text.muted" align="center">
          {t("item.opening")}
        </Text>
      </View>
    );
  }

  return (
    <WebView
      source={native ? { uri } : { html: html ?? "" }}
      originWhitelist={native ? ["file://*"] : ["about:blank"]}
      allowingReadAccessToURL={native ? uri : undefined}
      allowFileAccess={native}
      javaScriptEnabled={false}
      onShouldStartLoadWithRequest={(request) =>
        native ? request.url === uri : request.url === "about:blank"
      }
      onError={() => setFailed(true)}
      style={[styles.office, { backgroundColor: colors["bg.surface"] }]}
    />
  );
}

function PdfPreview({
  uri,
  name,
  onPages,
  onShare,
}: {
  uri: string;
  name: string;
  onPages: (pages: number) => void;
  onShare: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [page, setPage] = useState({ current: 1, total: 0 });
  const [failed, setFailed] = useState(false);
  const [reading, setReading] = useState(false);

  if (failed) {
    return (
      <View style={[styles.page, styles.center]}>
        <StateMessage
          icon="alert-triangle"
          tone="warning"
          title={t("item.pdfErrorTitle")}
          body={t("item.pdfErrorBody")}
          primary={{ label: t("item.download"), onPress: onShare }}
        />
      </View>
    );
  }

  return (
    <>
      <Pdf
        source={{ uri, cache: false }}
        horizontal
        enablePaging
        fitPolicy={2}
        trustAllCerts={false}
        style={[styles.page, { backgroundColor: colors["bg.subtle"] }]}
        onLoadComplete={(total) => {
          setPage({ current: 1, total });
          onPages(total);
        }}
        onPageChanged={(current, total) => setPage({ current, total })}
        onPageSingleTap={() => setReading(true)}
        onError={() => setFailed(true)}
      />
      {page.total > 0 ? <Pager page={page} /> : null}
      <Modal
        visible={reading}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setReading(false)}
      >
        <SafeAreaView
          style={[styles.reader, { backgroundColor: colors["bg.app"] }]}
        >
          <View style={styles.readerHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.done")}
              hitSlop={12}
              onPress={() => setReading(false)}
            >
              <Icon name="close" size={24} color="text.primary" />
            </Pressable>
            <Text variant="label" numberOfLines={1} style={styles.flex}>
              {name}
            </Text>
            <Text variant="caption" color="text.muted">
              {t("item.page", { current: page.current, total: page.total })}
            </Text>
          </View>
          <Pdf
            source={{ uri, cache: false }}
            page={page.current}
            spacing={12}
            maxScale={4}
            enableDoubleTapZoom
            trustAllCerts={false}
            style={[styles.flex, { backgroundColor: colors["bg.subtle"] }]}
            onPageChanged={(current, total) => setPage({ current, total })}
            onError={() => setFailed(true)}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function Pager({ page }: { page: { current: number; total: number } }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const dots = Math.min(page.total, 5);
  const active = Math.min(page.current, dots) - 1;
  return (
    <View style={styles.pager}>
      {Array.from({ length: dots }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === active
              ? { width: 18, backgroundColor: colors["action.primary"] }
              : { backgroundColor: colors["border.strong"] },
          ]}
        />
      ))}
      <Text variant="caption" color="text.muted" style={styles.pagerLabel}>
        {t("item.page", { current: page.current, total: page.total })}
      </Text>
    </View>
  );
}

function TextPreview({ uri }: { uri: string }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    new File(uri)
      .text()
      .then((content) => alive && setText(content))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [uri]);

  return (
    <ScrollView
      nestedScrollEnabled
      style={[styles.page, { backgroundColor: colors["bg.surface"] }]}
      contentContainerStyle={styles.textContent}
    >
      {failed ? (
        <Text variant="body-sm" color="text.muted">
          {t("item.textError")}
        </Text>
      ) : text === null ? (
        <ActivityIndicator color={colors["text.muted"]} />
      ) : (
        <Text variant="body-sm" selectable>
          {text}
        </Text>
      )}
    </ScrollView>
  );
}

function VideoPreview({ uri }: { uri: string }) {
  const { colors } = useTheme();
  const player = useVideoPlayer(uri);
  return (
    <View style={[styles.gallery, { backgroundColor: colors["bg.header"] }]}>
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        style={styles.video}
      />
    </View>
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
      <View style={styles.audioText}>
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
  flex: { flex: 1 },
  card: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderRadius: radius.lg,
    minHeight: 360,
  },
  center: { justifyContent: "center" },
  page: { alignSelf: "stretch", height: 296, borderRadius: 6 },
  office: { alignSelf: "stretch", height: 460, borderRadius: 6 },
  status: { alignItems: "center", gap: 10, alignSelf: "stretch" },
  errorOnDark: { margin: 14, padding: 16, borderRadius: radius.md },
  pager: { flexDirection: "row", alignItems: "center", gap: 6, height: 16 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pagerLabel: { marginLeft: 6 },
  gallery: {
    alignSelf: "stretch",
    gap: 12,
    paddingBottom: 14,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  photo: { height: 265, justifyContent: "center" },
  photoImage: { width: "100%", height: "100%" },
  photoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 34,
  },
  thumbs: { gap: 6 },
  thumb: { width: 44, height: 34, borderRadius: 5, overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%" },
  textContent: { padding: 16 },
  reader: { flex: 1 },
  readerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  video: { alignSelf: "stretch", height: 265 },
  audio: {
    alignSelf: "stretch",
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
  audioText: { flex: 1, gap: 8 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6 },
});
