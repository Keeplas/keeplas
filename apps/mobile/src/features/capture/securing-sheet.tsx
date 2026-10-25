import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Alert, StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { BottomSheet } from "@/components/sheet";
import { IconTile } from "@/components/surfaces";
import { Text } from "@/components/text";
import { UpgradeSheet } from "@/features/billing/upgrade-sheet";
import { useOutbox } from "@/features/outbox/outbox-provider";
import { useVaultData } from "@/features/vault/vault-data";
import { formatBytes } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";
import { draftStore } from "./draft-store";
import { draftHref } from "./draft-route";

type StepState = "done" | "active" | "waiting" | "error";

/**
 * M07-4 Securing your item: encrypt, upload, protected, in order. A sheet
 * the user can close at any time; the outbox keeps uploading in the
 * background. Opens the item once it is protected, if still showing.
 */
function SecuringSheet({
  entryId,
  visible,
  onDismiss,
}: {
  entryId: string;
  visible: boolean;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, language } = useI18n();
  const { colors } = useTheme();
  const { entries, progress, online, created, retry, discard } = useOutbox();
  const { pending } = useVaultData();
  const entry = entries.find((candidate) => candidate.id === entryId);
  const editable =
    !!entry && !entry.attachTo && !!draftStore.sendingDraft(entry.id);
  const itemId = created[entryId];
  const pendingTitle = pending.find((p) => p.entry.id === entryId)?.title;
  const [seen, setSeen] = useState<{ title: string; bytes: number }>();
  const [upgrading, setUpgrading] = useState(false);
  const lifetime = useViewer().plan === "lifetime";

  if (entry && pendingTitle !== undefined && seen?.title !== pendingTitle) {
    setSeen({
      title: pendingTitle ?? t("capture.untitled"),
      bytes: entry.files.reduce((sum, file) => sum + file.bytes, 0),
    });
  }

  useEffect(() => {
    if (!visible || !itemId) return;
    const timeout = setTimeout(() => {
      onDismiss();
      if (pathname !== `/item/${itemId}`)
        router.push({ pathname: "/item/[id]", params: { id: itemId } });
    }, 900);
    return () => clearTimeout(timeout);
  }, [visible, itemId, pathname, onDismiss, router]);

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
      ? t(`capture.securing.${lifetime ? "quotaBodyLifetime" : "quotaBody"}`, {
          size: formatBytes(seen?.bytes ?? 0, language),
        })
      : failed
        ? t(
            `capture.securing.${
              entry?.errorKind === "offline"
                ? "offlineFailedBody"
                : entry?.errorKind === "server"
                  ? "serverBody"
                  : "failedBody"
            }`,
          )
        : !online
          ? t("capture.securing.offlineBody")
          : t("capture.securing.uploadingBody", {
              pct: Math.round(ratio * 100),
            });

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      title={t("capture.securing.title")}
    >
      <View style={styles.body}>
        <View style={styles.file}>
          <IconTile icon="document" size={48} background={colors["bg.warm"]} />
          <View style={styles.flex}>
            <Text variant="label" numberOfLines={1}>
              {seen?.title ?? t("capture.untitled")}
            </Text>
            {seen?.bytes ? (
              <Text variant="body-sm" color="text.muted">
                {formatBytes(seen.bytes, language)}
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
        {entry?.status === "quota" && !lifetime ? (
          <Button label={t("upgrade.cta")} onPress={() => setUpgrading(true)} />
        ) : entry?.status === "quota" ? (
          <Button
            label={t("capture.securing.manageStorage")}
            onPress={() => {
              onDismiss();
              router.navigate("/settings");
            }}
          />
        ) : failed ? (
          <Button label={t("common.tryAgain")} onPress={retry} />
        ) : null}
        {failed && editable ? (
          <Button
            variant="secondary"
            label={t("capture.securing.editFirst")}
            onPress={() => {
              void discard(entryId).then(() => {
                if (!draftStore.reopenSending(entryId)) return;
                onDismiss();
                router.push(draftHref("/capture/compose"));
              });
            }}
          />
        ) : null}
        {failed ? (
          <Button
            variant="text"
            label={t("capture.securing.remove")}
            onPress={() =>
              Alert.alert(
                t("capture.securing.removeTitle"),
                t("capture.securing.removeBody"),
                [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("capture.securing.remove"),
                    style: "destructive",
                    onPress: () => {
                      const draft = draftStore.sendingDraft(entryId);
                      void discard(entryId).then(() => {
                        if (draft) draftStore.remove(draft.id);
                        onDismiss();
                      });
                    },
                  },
                ],
              )
            }
          />
        ) : null}
        {!failed && !itemId ? (
          <Button
            variant="secondary"
            label={t("capture.securing.background")}
            onPress={onDismiss}
          />
        ) : null}
      </View>
      {/* Nested in the sheet so iOS presents it over this modal. */}
      <UpgradeSheet
        visible={upgrading}
        onDismiss={() => setUpgrading(false)}
        onLeave={onDismiss}
      />
    </BottomSheet>
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

const SecuringSheetContext = createContext<(entryId: string) => void>(
  () => undefined,
);

/** Holds the securing sheet above the stack, so it outlives the capture screens. */
export function SecuringSheetProvider({ children }: { children: ReactNode }) {
  const [entryId, setEntryId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const show = useCallback((id: string) => {
    setEntryId(id);
    setVisible(true);
  }, []);
  const dismiss = useCallback(() => setVisible(false), []);
  return (
    <SecuringSheetContext.Provider value={show}>
      {children}
      {entryId ? (
        <SecuringSheet
          key={entryId}
          entryId={entryId}
          visible={visible}
          onDismiss={dismiss}
        />
      ) : null}
    </SecuringSheetContext.Provider>
  );
}

export const useShowSecuring = () => useContext(SecuringSheetContext);

const styles = StyleSheet.create({
  body: { gap: 20, paddingTop: 6 },
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
