import { useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { Icon, type IconName } from "@/components/icon";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { SHEET_CLOSE_MS } from "@/features/capture/add-sheet";
import { VAULT_GROUPS } from "@/features/home/vault-groups";
import { CategoryNameForm } from "@/features/vault/category-sheet";
import { useVaultData } from "@/features/vault/vault-data";
import {
  useFilterTitle,
  VaultItemList,
} from "@/features/vault/vault-item-list";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";
import { colors as palette, radius, withAlpha } from "@/theme";

/**
 * A category opened from Home, built-in (Documents…) or user-made: its
 * items with search, and its actions in the ⋮ menu. A built-in category
 * cannot be renamed; deleting it hides it until Settings → Categories
 * restores it.
 */
export default function CategoryPage() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const categoryId = id as Id<"vault_categories">;
  const router = useRouter();
  const { t } = useI18n();
  const title = useFilterTitle();
  const { categories } = useVaultData();
  const hidden = useViewer().hiddenCategoryGroups ?? [];
  const setHidden = useAuditedMutation(api.users.setHiddenCategoryGroups);
  const rename = useAuditedMutation(api.vault_categories.rename);
  const remove = useAuditedMutation(api.vault_categories.remove);
  const [renaming, setRenaming] = useState(false);
  const group = VAULT_GROUPS.find((candidate) => candidate.key === id)?.key;
  const name = title(id);

  function confirmDelete() {
    Alert.alert(
      t("categories.deleteTitle", { name }),
      t("categories.deleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("categories.delete"),
          style: "destructive",
          onPress: () =>
            void (
              group
                ? setHidden({ groups: [...hidden, group] })
                : remove({ categoryId })
            )
              .then(() => router.back())
              .catch(() =>
                toast({ variant: "error", title: t("common.genericError") }),
              ),
        },
      ],
    );
  }

  const deleteAction: MenuAction = {
    icon: "trash",
    label: t("categories.deleteCategory"),
    onPress: confirmDelete,
    destructive: true,
  };

  return (
    <Screen
      header={
        <NavBar
          title={name}
          onBack={router.back}
          right={
            <MoreMenu
              label={t("itemActions.more", { title: name })}
              actions={
                group
                  ? [deleteAction]
                  : [
                      {
                        icon: "edit",
                        label: t("categories.rename"),
                        onPress: () => setRenaming(true),
                      },
                      deleteAction,
                    ]
              }
            />
          }
        />
      }
      scroll={false}
    >
      <VaultItemList
        filter={id}
        searchLabel={t("categories.search", { name })}
      />
      <BottomSheet
        visible={renaming}
        onDismiss={() => setRenaming(false)}
        title={t("categories.rename")}
      >
        {renaming ? (
          <CategoryNameForm
            initial={categories?.find((row) => row.id === id)?.name ?? ""}
            submitLabel={t("capture.save")}
            onSubmit={async (encryptedName) => {
              await rename({ categoryId, encryptedName });
              setRenaming(false);
            }}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

interface MenuAction {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/**
 * ⋮ button and its menu, anchored under it over the sheet scrim. An action
 * runs once the menu has faded out: iOS presents no sheet or alert over a
 * closing modal.
 */
function MoreMenu({
  label,
  actions,
}: {
  label: string;
  actions: MenuAction[];
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const button = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number }>();

  function run(action: MenuAction) {
    setAnchor(undefined);
    setTimeout(action.onPress, SHEET_CLOSE_MS);
  }

  return (
    <>
      <Pressable
        ref={button}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={4}
        onPress={() =>
          button.current?.measureInWindow((x, y, w, h) =>
            setAnchor({ top: y + h + 6, right: width - x - w }),
          )
        }
        style={({ pressed }) => [
          styles.button,
          { borderColor: colors["border.default"] },
          pressed && { backgroundColor: colors["bg.subtle"] },
        ]}
      >
        <Icon name="more" size={20} />
      </Pressable>
      {/* Translucent status bar on Android: the modal then shares the
          window coordinates measured above. */}
      <Modal
        transparent
        statusBarTranslucent
        animationType="fade"
        visible={anchor !== undefined}
        onRequestClose={() => setAnchor(undefined)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAnchor(undefined)}>
          <View
            accessibilityRole="menu"
            style={[
              styles.menu,
              anchor,
              {
                backgroundColor: colors["bg.surface"],
                borderColor: colors["border.default"],
              },
            ]}
          >
            {actions.map((action, index) => {
              const tone = action.destructive
                ? "action.danger"
                : "text.primary";
              return (
                <Pressable
                  key={action.label}
                  accessibilityRole="menuitem"
                  onPress={() => run(action)}
                  style={({ pressed }) => [
                    styles.item,
                    index > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: colors["border.default"],
                    },
                    pressed && { backgroundColor: colors["bg.subtle"] },
                  ]}
                >
                  <Icon name={action.icon} size={20} color={tone} />
                  <Text color={tone}>{action.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  // Figma Scrim, as under the bottom sheets: navy/950 at 35 %.
  backdrop: { flex: 1, backgroundColor: withAlpha(palette.navy["950"], 0.35) },
  menu: {
    position: "absolute",
    minWidth: 220,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  item: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
  },
});
