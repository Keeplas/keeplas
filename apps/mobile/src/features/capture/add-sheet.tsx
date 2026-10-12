import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Icon, type IconName } from "@/components/icon";
import { BottomSheet } from "@/components/sheet";
import { StateSheet } from "@/components/state-message";
import { IconTile } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";
import { draftStore, type CaptureKind } from "./draft-store";
import {
  chooseFromLibrary,
  PermissionDenied,
  shoot,
  type PermissionProblem,
} from "./media";
import type { CaptureFile } from "./seal";

const SHEET_CLOSE_MS = 350;

const ITEMS: { kind: CaptureKind; icon: IconName; key: string }[] = [
  { kind: "scan", icon: "document", key: "document" },
  { kind: "photo", icon: "photo", key: "photo" },
  { kind: "voice", icon: "mic", key: "voice" },
  { kind: "note", icon: "note", key: "note" },
  { kind: "video", icon: "video", key: "video" },
];

/**
 * M07-1 Add to Keeplas: the bottom sheet behind the tab bar's (+). Each
 * row opens a capture: scan (M07-2), photo, voice (M07-3), note (M07-9),
 * video. Everything is encrypted on the phone before it leaves it.
 */
function AddSheet({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [denied, setDenied] = useState<PermissionProblem | null>(null);

  async function withMedia(
    kind: CaptureKind,
    get: () => Promise<CaptureFile[]>,
  ) {
    try {
      const files = await get();
      if (files.length === 0) return;
      draftStore.start(kind, { files });
      router.push("/capture/compose");
    } catch (error) {
      if (error instanceof PermissionDenied) setDenied(error.what);
      else Alert.alert(t("common.genericError"));
    }
  }

  function open(kind: CaptureKind) {
    onDismiss();
    // iOS refuses to present the camera or an alert while the sheet's
    // modal is still sliding out.
    setTimeout(() => start(kind), SHEET_CLOSE_MS);
  }

  function start(kind: CaptureKind) {
    switch (kind) {
      case "scan":
        draftStore.start("scan");
        router.push("/capture/scan");
        return;
      case "voice":
        router.push("/capture/voice");
        return;
      case "note":
        draftStore.start("note");
        router.push("/capture/compose");
        return;
      case "video":
        void withMedia("video", async () => {
          const file = await shoot("videos");
          return file ? [file] : [];
        });
        return;
      case "photo":
        Alert.alert(t("capture.photo"), undefined, [
          {
            text: t("capture.takePhoto"),
            onPress: () =>
              void withMedia("photo", async () => {
                const file = await shoot("images");
                return file ? [file] : [];
              }),
          },
          {
            text: t("capture.chooseLibrary"),
            onPress: () => void withMedia("photo", () => chooseFromLibrary()),
          },
          { text: t("common.cancel"), style: "cancel" },
        ]);
        return;
    }
  }

  return (
    <>
      <BottomSheet
        visible={visible}
        onDismiss={onDismiss}
        title={t("capture.addTitle")}
      >
        {ITEMS.map((item) => (
          <AddMenuItem
            key={item.kind}
            icon={item.icon}
            title={t(`capture.${item.key}`)}
            description={t(`capture.${item.key}Body`)}
            onPress={() => open(item.kind)}
          />
        ))}
      </BottomSheet>
      <PermissionSheet problem={denied} onDismiss={() => setDenied(null)} />
    </>
  );
}

const AddSheetContext = createContext<() => void>(() => undefined);

/** Holds the Add sheet for the tabs; `useOpenAddSheet` opens it anywhere. */
export function AddSheetProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const show = useCallback(() => setVisible(true), []);
  return (
    <AddSheetContext.Provider value={show}>
      {children}
      <AddSheet visible={visible} onDismiss={() => setVisible(false)} />
    </AddSheetContext.Provider>
  );
}

export const useOpenAddSheet = () => useContext(AddSheetContext);

/** Figma `Add menu / Item`: 62 pt card, 40 pt sky tile, chevron 18. */
function AddMenuItem({
  icon,
  title,
  description,
  onPress,
}: {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: pressed ? colors["bg.subtle"] : colors["bg.surface"],
          borderColor: colors["border.default"],
        },
      ]}
    >
      <IconTile
        icon={icon}
        size={40}
        iconSize={20}
        background={colors["accent.soft"]}
      />
      <View style={styles.text}>
        <Text variant="label">{title}</Text>
        <Text variant="body-sm" color="text.muted">
          {description}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color="text.muted" />
    </Pressable>
  );
}

/** Section 10 "Permissions · … access is off" as a sheet. */
export function PermissionSheet({
  problem,
  onDismiss,
}: {
  problem: PermissionProblem | null;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const icon: Record<PermissionProblem, IconName> = {
    camera: "camera",
    photos: "photo",
    microphone: "mic",
  };
  return (
    <StateSheet
      visible={problem !== null}
      onDismiss={onDismiss}
      icon={problem ? icon[problem] : "camera"}
      tone="neutral"
      title={t(`permissions.${problem ?? "camera"}Title`)}
      body={t(`permissions.${problem ?? "camera"}Body`)}
      primary={{
        label: t("common.openSettings"),
        onPress: () => {
          onDismiss();
          void Linking.openSettings();
        },
      }}
      secondary={{ label: t("common.notNow"), onPress: onDismiss }}
    />
  );
}

const styles = StyleSheet.create({
  item: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  text: { flex: 1, gap: 2 },
});
