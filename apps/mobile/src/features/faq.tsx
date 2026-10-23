import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Card } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useTheme } from "@/providers/theme-provider";

export interface FaqEntry {
  question: string;
  answer: string;
}

/** One question that opens to show its answer. */
function FaqItem({ question, answer, last }: FaqEntry & { last: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View
      style={[
        styles.item,
        !last && styles.divider,
        { borderColor: colors["border.default"] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.question}
      >
        <Text variant="label" style={styles.flex}>
          {question}
        </Text>
        <Icon
          name={open ? "chevron-down" : "chevron-right"}
          size={18}
          color="text.muted"
        />
      </Pressable>
      {open ? (
        <Text variant="body" color="text.muted">
          {answer}
        </Text>
      ) : null}
    </View>
  );
}

/** A titled group of questions in one card. */
export function FaqSection({
  title,
  items,
}: {
  title: string;
  items: FaqEntry[];
}) {
  return (
    <>
      <Text variant="label">{title}</Text>
      <Card gap={0}>
        {items.map((item, i) => (
          <FaqItem
            key={item.question}
            {...item}
            last={i === items.length - 1}
          />
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  item: { gap: 8, paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  question: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
});
