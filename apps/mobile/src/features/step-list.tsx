import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Card, InfoRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useTheme } from "@/providers/theme-provider";

export interface Step {
  title: string;
  description?: string;
  done: boolean;
}

/**
 * Numbered checklist card (M09-7): done steps get a green check, the current
 * one a filled navy number, later ones a muted number.
 */
export function StepList({ steps }: { steps: Step[] }) {
  const { colors } = useTheme();
  const current = steps.findIndex((s) => !s.done);
  return (
    <Card gap={16}>
      {steps.map((step, index) => {
        const isCurrent = index === current;
        const marker = step.done ? (
          <View
            style={[
              styles.marker,
              { backgroundColor: colors["status.active"] },
            ]}
          >
            <Icon name="check" size={16} color="text.inverse" />
          </View>
        ) : (
          <View
            style={[
              styles.marker,
              {
                backgroundColor: isCurrent
                  ? colors["action.primary"]
                  : colors["bg.subtle"],
              },
            ]}
          >
            <Text
              variant="caption"
              color={isCurrent ? "text.inverse" : "text.subtle"}
            >
              {index + 1}
            </Text>
          </View>
        );
        return (
          <View
            key={step.title}
            style={{ opacity: step.done || isCurrent ? 1 : 0.7 }}
          >
            <InfoRow
              leading={marker}
              title={step.title}
              description={step.description}
            />
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
