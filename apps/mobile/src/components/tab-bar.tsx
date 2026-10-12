import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { Icon, type IconName } from "./icon";
import { Text } from "./text";

const TABS: Record<string, { icon: IconName; label: string }> = {
  home: { icon: "home", label: "nav.home" },
  search: { icon: "search", label: "nav.search" },
  people: { icon: "people", label: "nav.people" },
  settings: { icon: "settings", label: "nav.settings" },
};

/** The subset of React Navigation's tab bar props this bar needs. */
export interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
  onAdd: () => void;
}

/**
 * Figma `Tab Bar`: Home, Search, FAB (+), People, Settings on a surface with
 * a top border. Active item gets the `bg/info` pill.
 */
export function TabBar({ state, navigation, onAdd }: TabBarProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const items = state.routes.filter((route) => route.name in TABS);
  const half = Math.ceil(items.length / 2);

  const renderItem = (route: { key: string; name: string }) => {
    const focused = state.routes[state.index]?.key === route.key;
    const tab = TABS[route.name];
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onPress={() => navigation.navigate(route.name)}
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
      {items.slice(0, half).map(renderItem)}
      <Fab onPress={onAdd} label={t("nav.add")} />
      {items.slice(half).map(renderItem)}
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
