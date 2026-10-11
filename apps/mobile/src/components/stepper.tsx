import { StyleSheet, View } from "react-native";

import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { Icon } from "./icon";
import { Card } from "./surfaces";
import { Text } from "./text";

const STEP_KEYS = [
  "steps.verifyPhone",
  "steps.createPasskey",
  "steps.createVault",
];

/**
 * Figma `Stepper / Required steps`: card with "n/3 completed" and three
 * 28 pt circles (done = filled check, current = sky ring, next = grey ring).
 */
export function RequiredSteps({ completed }: { completed: number }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const total = STEP_KEYS.length;
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="body-sm">{t("steps.required")}</Text>
        <Text variant="body-sm-strong" color="accent.text">
          {t("steps.completed", { done: completed, total })}
        </Text>
      </View>
      <View style={styles.steps}>
        <View
          style={[styles.line, { backgroundColor: colors["border.strong"] }]}
        />
        {completed > 1 ? (
          <View
            style={[
              styles.line,
              {
                backgroundColor: colors["action.primary"],
                right: completed >= total ? "16.67%" : "50%",
              },
            ]}
          />
        ) : null}
        {STEP_KEYS.map((key, index) => {
          const done = index < completed;
          const current = index === completed;
          return (
            <View key={key} style={styles.step}>
              <View
                style={[
                  styles.circle,
                  done
                    ? {
                        backgroundColor: colors["action.primary"],
                        borderColor: colors["action.primary"],
                      }
                    : {
                        backgroundColor: colors["bg.surface"],
                        borderColor: current
                          ? colors["border.focus"]
                          : colors["border.strong"],
                      },
                ]}
              >
                {done ? (
                  <Icon name="check" size={16} color="text.inverse" />
                ) : (
                  <Text
                    variant="caption"
                    color={current ? "accent.text" : "text.subtle"}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                variant="caption"
                color="text.muted"
                align="center"
                style={styles.label}
              >
                {t(key)}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 12 },
  header: { flexDirection: "row", justifyContent: "space-between" },
  steps: { flexDirection: "row", height: 64 },
  // Runs between the first and last circle centres (1/6 and 5/6 of the row).
  line: {
    position: "absolute",
    top: 13,
    height: 2,
    left: "16.67%",
    right: "16.67%",
  },
  step: { flex: 1, alignItems: "center", gap: 4 },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { maxWidth: 64 },
});
