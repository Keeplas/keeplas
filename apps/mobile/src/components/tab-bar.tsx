import { createContext, useContext } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_NAMES, type TabName } from "@/features/navigation/tab-routes";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { Icon, type IconName } from "./icon";
import { Text } from "./text";

const TABS: Record<TabName, { icon: IconName; label: string }> = {
  home: { icon: "home", label: "nav.home" },
  search: { icon: "search", label: "nav.search" },
  people: { icon: "people", label: "nav.people" },
  settings: { icon: "settings", label: "nav.settings" },
};

export const TabBarVisibleContext = createContext(false);

export const useTabBarVisible = () => useContext(TabBarVisibleContext);

export interface TabBarProps {
  active: TabName;
  onSelect: (tab: TabName) => void;
  onAdd: () => void;
}

/**
 * Figma `Tab Bar`: Home, Search, FAB (+), People, Settings on a surface with
 * a top border. Active item gets the `bg/info` pill.
 */
export function TabBar({ active, onSelect, onAdd }: TabBarProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const half = Math.ceil(TAB_NAMES.length / 2);

  const renderItem = (name: TabName) => {
    const focused = name === active;
    const tab = TABS[name];
    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onPress={() => onSelect(name)}
        hitSlop={{ top: 4, bottom: 4 }}
        style={[styles.item, focused && { backgroundColor: colors["bg.info"] }]}
      >
        <Icon
          name={tab.icon}
          size={22}
          color={focused ? "text.primary" : "text.muted"}
        />
        <Text variant="caption" color={focused ? "text.primary" : "text.muted"}>
          {t(tab.label)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors["bg.surface"],
          borderTopColor: colors["border.default"],
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {TAB_NAMES.slice(0, half).map(renderItem)}
      <Fab onPress={onAdd} label={t("nav.add")} />
      {TAB_NAMES.slice(half).map(renderItem)}
    </View>
  );
}

/** Figma `FAB / Add`: 56 pt circle, plus icon; soft shadow in light only. */
export function Fab({
  onPress,
  label,
}: {
  onPress: () => void;
  label: string;
}) {
  const { colors, scheme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.fab,
        { backgroundColor: colors["action.primary"] },
        scheme === "light" && {
          shadowColor: colors["text.primary"],
          shadowOpacity: 0.28,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        },
      ]}
    >
      <Icon name="plus" size={26} color="text.inverse" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  item: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
