import { useState } from "react";
import { Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";

import { Icon, type IconName } from "@/components/icon";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { StateMessage } from "@/components/state-message";
import { ListRow } from "@/components/surfaces";
import { SHEET_CLOSE_MS } from "@/features/capture/add-sheet";
import { draftHref } from "@/features/capture/draft-route";
import {
  draftStore,
  useDrafts,
  type CaptureKind,
  type Draft,
} from "@/features/capture/draft-store";
import { relativeDay } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";

const KIND_ICON: Record<CaptureKind, IconName> = {
  note: "note",
  photo: "photo",
  video: "video",
  voice: "mic",
  scan: "document",
  file: "document",
};

export default function Drafts() {
  const router = useRouter();
  const { t } = useI18n();
  const drafts = useDrafts();
  const [chosen, setChosen] = useState<Draft | null>(null);

  function resume(draft: Draft) {
    setChosen(null);
    draftStore.open(draft.id);
    router.push(draftHref("/capture/compose"));
  }

  function confirmDelete(draft: Draft) {
    setChosen(null);
    setTimeout(
      () =>
        Alert.alert(t("drafts.deleteTitle"), t("drafts.deleteBody"), [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("drafts.delete"),
            style: "destructive",
            onPress: () => draftStore.remove(draft.id),
          },
        ]),
      SHEET_CLOSE_MS,
    );
  }

  function describe(draft: Draft) {
    const when = relativeDay(draft.updatedAt);
    const files = draft.files.length + (draft.pages.length ? 1 : 0);
    return [
      t(`vaultList.time.${when.key}`, { n: when.n }),
      files ? t("capture.attachments", { n: files }) : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const header = <NavBar title={t("drafts.title")} onBack={router.back} />;

  if (drafts.length === 0) {
    return (
      <Screen header={header} center>
        <StateMessage
          icon="note"
          tone="info"
          title={t("drafts.emptyTitle")}
          body={t("drafts.emptyBody")}
        />
      </Screen>
    );
  }

  return (
    <Screen header={header} gap={12}>
      {drafts.map((draft) => (
        <ListRow
          key={draft.id}
          icon={KIND_ICON[draft.kind]}
          title={draft.title.trim() || t("capture.untitled")}
          description={describe(draft)}
          onPress={() => resume(draft)}
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("drafts.menuTitle")}
              hitSlop={12}
              onPress={() => setChosen(draft)}
            >
              <Icon name="more" size={20} color="text.muted" />
            </Pressable>
          }
        />
      ))}

      <BottomSheet
        visible={chosen !== null}
        onDismiss={() => setChosen(null)}
        title={chosen?.title.trim() || t("capture.untitled")}
      >
        {chosen ? (
          <>
            <ListRow
              icon="edit"
              title={t("drafts.resume")}
              onPress={() => resume(chosen)}
            />
            <ListRow
              icon="trash"
              title={t("drafts.delete")}
              description={t("drafts.deleteRowBody")}
              onPress={() => confirmDelete(chosen)}
            />
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
