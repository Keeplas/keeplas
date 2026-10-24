import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Icon, type IconName } from "@/components/icon";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";

const OPTIONS: { key: "mine" | "shared"; icon: IconName; label: string }[] = [
  { key: "mine", icon: "folder", label: "shared.myVault" },
  { key: "shared", icon: "people", label: "shared.title" },
];

export function VaultSwitch({ active }: { active: "mine" | "shared" }) {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.switch,
        {
          backgroundColor: colors["bg.subtle"],
          borderColor: colors["border.default"],
        },
      ]}
    >
      {OPTIONS.map((option) => {
        const selected = option.key === active;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              if (option.key === "shared") {
                router.push("/shared");
                return;
              }
              // "My vault" is the Vault tab.
              if (router.canDismiss()) router.dismissAll();
              router.navigate("/vault");
            }}
            style={[
              styles.option,
              selected && {
                backgroundColor: colors["bg.info"],
                borderColor: colors["border.focus"],
              },
            ]}
          >
            <Icon
              name={option.icon}
              size={20}
              color={selected ? "text.primary" : "text.muted"}
            />
            <Text
              variant="body-sm"
              color={selected ? "text.primary" : "text.muted"}
            >
              {t(option.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  switch: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  option: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radius.sm,
  },
});
