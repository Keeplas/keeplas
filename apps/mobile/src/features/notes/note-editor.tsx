import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  BlockquoteBridge,
  BoldBridge,
  BulletListBridge,
  CodeBridge,
  CoreBridge,
  HardBreakBridge,
  HeadingBridge,
  HistoryBridge,
  ItalicBridge,
  LinkBridge,
  ListItemBridge,
  OrderedListBridge,
  PlaceholderBridge,
  RichText,
  StrikeBridge,
  UnderlineBridge,
  useBridgeState,
  useEditorBridge,
  useEditorContent,
} from "@10play/tentap-editor";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { interFontCss } from "./inter-font";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";

export function NoteEditor({
  initialHtml,
  placeholder,
  onChange,
}: {
  initialHtml: string;
  placeholder: string;
  onChange: (html: string) => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [setup] = useState(() => {
    const css = `
      * { font-family: "Inter", -apple-system, Roboto, sans-serif; }
      body { background: transparent; color: ${colors["text.primary"]}; }
      .ProseMirror { min-height: 170px; padding: 12px 14px; font-size: 17px; line-height: 25px; outline: none; }
      .ProseMirror p { margin: 0 0 8px; }
      .ProseMirror h1, .ProseMirror h2, .ProseMirror h3 { font-family: Georgia, serif; font-weight: 600; margin: 4px 0 8px; }
      .ProseMirror h2 { font-size: 22px; line-height: 28px; }
      .ProseMirror blockquote { border-left: 3px solid ${colors["border.strong"]}; margin: 0 0 8px; padding-left: 12px; color: ${colors["text.muted"]}; }
      .ProseMirror ul, .ProseMirror ol { padding-left: 22px; margin: 0 0 8px; }
      .ProseMirror a { color: ${colors["text.link"]}; }
      .ProseMirror p.is-editor-empty:first-child::before { color: ${colors["text.subtle"]}; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
    `;
    return {
      initialContent: initialHtml,
      // tentap paints the web view white by default; let the themed
      // surface behind it show through instead (unreadable in dark mode).
      theme: { webview: { backgroundColor: "transparent" } },
      bridgeExtensions: [
        CoreBridge.configureCSS(css),
        PlaceholderBridge.configureExtension({ placeholder }),
        BoldBridge,
        ItalicBridge,
        UnderlineBridge,
        StrikeBridge,
        CodeBridge,
        HeadingBridge,
        BulletListBridge,
        OrderedListBridge,
        ListItemBridge,
        BlockquoteBridge,
        HardBreakBridge,
        HistoryBridge,
        LinkBridge.configureExtension({ openOnClick: false }),
      ],
    };
  });
  const editor = useEditorBridge(setup);
  const state = useBridgeState(editor);
  const content = useEditorContent(editor, { type: "html" });
  const report = useRef(onChange);

  useEffect(() => {
    report.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!state.isReady) return;
    void interFontCss()
      .then((css) => editor.injectCSS(css, "inter-font"))
      .catch(() => undefined);
  }, [state.isReady, editor]);

  useEffect(() => {
    if (content !== undefined) report.current(content);
  }, [content]);

  const tools: {
    key: string;
    label: string;
    glyph: ReactNode;
    active?: boolean;
    disabled?: boolean;
    onPress: () => void;
  }[] = [
    {
      key: "heading",
      label: t("noteEditor.heading"),
      glyph: <Text variant="h3">H</Text>,
      active: state.headingLevel === 2,
      onPress: () => editor.toggleHeading(2),
    },
    {
      key: "bold",
      label: t("noteEditor.bold"),
      glyph: <Text variant="label">B</Text>,
      active: state.isBoldActive,
      onPress: editor.toggleBold,
    },
    {
      key: "italic",
      label: t("noteEditor.italic"),
      glyph: <Text style={styles.italic}>I</Text>,
      active: state.isItalicActive,
      onPress: editor.toggleItalic,
    },
    {
      key: "underline",
      label: t("noteEditor.underline"),
      glyph: <Text style={styles.underline}>U</Text>,
      active: state.isUnderlineActive,
      onPress: editor.toggleUnderline,
    },
    {
      key: "strike",
      label: t("noteEditor.strike"),
      glyph: <Text style={styles.strike}>S</Text>,
      active: state.isStrikeActive,
      onPress: editor.toggleStrike,
    },
    {
      key: "bullets",
      label: t("noteEditor.bulletList"),
      glyph: <Text variant="label">•≡</Text>,
      active: state.isBulletListActive,
      onPress: editor.toggleBulletList,
    },
    {
      key: "numbers",
      label: t("noteEditor.numberedList"),
      glyph: <Text variant="label">1.</Text>,
      active: state.isOrderedListActive,
      onPress: editor.toggleOrderedList,
    },
    {
      key: "quote",
      label: t("noteEditor.quote"),
      glyph: <Text variant="h3">“</Text>,
      active: state.isBlockquoteActive,
      onPress: editor.toggleBlockquote,
    },
    {
      key: "undo",
      label: t("noteEditor.undo"),
      glyph: (
        <View style={styles.mirror}>
          <Icon name="rotate" size={18} />
        </View>
      ),
      disabled: !state.canUndo,
      onPress: editor.undo,
    },
    {
      key: "redo",
      label: t("noteEditor.redo"),
      glyph: <Icon name="rotate" size={18} />,
      disabled: !state.canRedo,
      onPress: editor.redo,
    },
  ];

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: colors["bg.surface"],
          borderColor: colors["border.default"],
        },
      ]}
    >
      <View
        style={[
          styles.toolbar,
          { borderBottomColor: colors["border.default"] },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.tools}
        >
          {tools.map((tool) => (
            <Pressable
              key={tool.key}
              accessibilityRole="button"
              accessibilityLabel={tool.label}
              accessibilityState={{
                selected: tool.active,
                disabled: tool.disabled,
              }}
              disabled={tool.disabled}
              onPress={tool.onPress}
              style={[
                styles.tool,
                tool.active && { backgroundColor: colors["bg.info"] },
                tool.disabled && styles.disabled,
              ]}
            >
              {tool.glyph}
            </Pressable>
          ))}
        </ScrollView>
        {/* The editor is a web view: tapping outside doesn't close its
            keyboard, so give a way out without saving. */}
        {state.isFocused ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={editor.blur}
            style={[styles.done, { borderLeftColor: colors["border.default"] }]}
          >
            <Text variant="label" color="accent.text">
              {t("common.done")}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.web}>
        {/* Keep iOS's native bar above the keyboard so "Done" also sits
            on the keyboard itself (tentap hides it by default). */}
        <RichText
          editor={editor}
          scrollEnabled
          hideKeyboardAccessoryView={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, overflow: "hidden" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tools: { paddingHorizontal: 6, paddingVertical: 6, gap: 2 },
  tool: {
    minWidth: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  done: {
    alignSelf: "stretch",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  disabled: { opacity: 0.35 },
  mirror: { transform: [{ scaleX: -1 }] },
  italic: { fontStyle: "italic", fontSize: 17 },
  underline: { textDecorationLine: "underline", fontSize: 17 },
  strike: { textDecorationLine: "line-through", fontSize: 17 },
  web: { height: 200 },
});
