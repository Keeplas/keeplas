import { memo, useMemo } from "react";
import { Text as RNText, StyleSheet, View, type TextStyle } from "react-native";

import { Text } from "@/components/text";
import { parseNote, type Mark, type Run } from "@keeplas/export/rich-text";
import { useTheme } from "@/providers/theme-provider";
import { fonts } from "@/theme";

const MARK_STYLE: Record<Exclude<Mark, "bold" | "italic">, TextStyle> = {
  underline: { textDecorationLine: "underline" },
  strike: { textDecorationLine: "line-through" },
  code: { fontFamily: "Menlo" },
};

function markStyle(marks: Mark[], serif: boolean): TextStyle[] {
  const bold = marks.includes("bold");
  const italic = marks.includes("italic");
  const style: TextStyle[] = [];
  if (serif) {
    if (italic) style.push({ fontStyle: "italic" });
  } else if (bold && italic) {
    style.push({ fontFamily: fonts.uiSemiboldItalic });
  } else if (italic) {
    style.push({ fontFamily: fonts.uiItalic });
  } else if (bold) {
    style.push({ fontFamily: fonts.uiSemibold });
  }
  for (const mark of marks) {
    if (mark !== "bold" && mark !== "italic") style.push(MARK_STYLE[mark]);
  }
  if (marks.includes("underline") && marks.includes("strike")) {
    style.push({ textDecorationLine: "underline line-through" });
  }
  return style;
}

function Runs({ runs, serif = false }: { runs: Run[]; serif?: boolean }) {
  return runs.map((run, index) =>
    run.marks.length ? (
      <RNText key={index} style={markStyle(run.marks, serif)}>
        {run.text}
      </RNText>
    ) : (
      run.text
    ),
  );
}

export const NoteView = memo(function NoteView({ note }: { note: string }) {
  const { colors } = useTheme();
  const blocks = useMemo(() => parseNote(note), [note]);

  return (
    <View style={styles.root}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <Text key={index} variant={block.level <= 2 ? "h2" : "h3"}>
                <Runs runs={block.runs} serif />
              </Text>
            );
          case "quote":
            return (
              <View
                key={index}
                style={[
                  styles.quote,
                  { borderLeftColor: colors["border.strong"] },
                ]}
              >
                <Text variant="body" color="text.muted">
                  <Runs runs={block.runs} />
                </Text>
              </View>
            );
          case "item":
            return (
              <View
                key={index}
                style={[styles.item, { paddingLeft: 4 + block.depth * 18 }]}
              >
                <Text variant="body" style={styles.bullet}>
                  {block.ordered ? `${block.index}.` : "•"}
                </Text>
                <Text variant="body" style={styles.flex}>
                  <Runs runs={block.runs} />
                </Text>
              </View>
            );
          default:
            return (
              <Text key={index} variant="body">
                <Runs runs={block.runs} />
              </Text>
            );
        }
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: 8 },
  quote: { borderLeftWidth: 3, paddingLeft: 12 },
  item: { flexDirection: "row", gap: 8 },
  bullet: { minWidth: 18 },
  flex: { flex: 1 },
});
