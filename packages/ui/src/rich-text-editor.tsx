"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "./lib/utils";
import { Icon } from "./icon";

const TOOLBAR_ICONS = {
  bold: "M6.75 3.75h6.375a4.125 4.125 0 0 1 0 8.25H6.75V3.75Zm0 8.25h7.5a4.125 4.125 0 0 1 0 8.25H6.75V12Z",
  italic: "M9.75 3.75h9m-9 16.5h9M14.25 3.75 9.75 20.25",
  bulletList:
    "M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 17.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM7.5 6.75h12.75M7.5 12h12.75M7.5 17.25h12.75",
  orderedList:
    "M8.242 5.992h12M8.242 12h12m-12 6.008h12M3 6.7l1.5-1.5v6m-1.5 6h3M4.5 18l-1.5 1.5h3",
  heading: "M5.25 4.5v15m13.5-15v15m-13.5-7.5h13.5",
  quote:
    "M6.75 6.75h3v3a4.5 4.5 0 0 1-4.5 4.5m13.5-7.5h3v3a4.5 4.5 0 0 1-4.5 4.5",
  undo: "M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3",
  redo: "m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3",
};

export interface RichTextEditorProps {
  value: string;
  onChange?: (html: string) => void;
  onPlainTextChange?: (text: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  minHeight?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  // Display-only mode: hides the toolbar, disables editing, and routes
  // arbitrary HTML through TipTap's parser so unknown tags / scripts are
  // dropped before render. Use this to safely show decrypted rich-text
  // content authored elsewhere.
  readOnly?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  icon: string;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  icon,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        active && "bg-secondary/15 text-secondary",
      )}
    >
      <Icon path={icon} className="w-4 h-4" />
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-outline-variant/40 bg-surface-container-low rounded-t-xl">
      <ToolbarButton
        label="Heading"
        icon={TOOLBAR_ICONS.heading}
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="Bold"
        icon={TOOLBAR_ICONS.bold}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="Italic"
        icon={TOOLBAR_ICONS.italic}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <span className="w-px h-5 bg-outline-variant/40 mx-1" />
      <ToolbarButton
        label="Bullet list"
        icon={TOOLBAR_ICONS.bulletList}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="Numbered list"
        icon={TOOLBAR_ICONS.orderedList}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Quote"
        icon={TOOLBAR_ICONS.quote}
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <span className="w-px h-5 bg-outline-variant/40 mx-1" />
      <ToolbarButton
        label="Undo"
        icon={TOOLBAR_ICONS.undo}
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        label="Redo"
        icon={TOOLBAR_ICONS.redo}
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  onPlainTextChange,
  placeholder,
  className,
  editorClassName,
  minHeight = 240,
  disabled,
  autoFocus,
  readOnly,
}: RichTextEditorProps) {
  const editable = !readOnly && !disabled;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? "",
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
      }),
    ],
    content: value,
    editable,
    immediatelyRender: false,
    autofocus: !readOnly && autoFocus,
    onUpdate: ({ editor }) => {
      if (readOnly) return;
      const html = editor.getHTML();
      onChange?.(html);
      onPlainTextChange?.(editor.getText());
    },
    editorProps: {
      attributes: {
        class: cn(
          "tiptap-content prose prose-sm max-w-none focus:outline-none text-on-surface",
          readOnly ? "px-0 py-0" : "px-4 py-3",
          editorClassName,
        ),
        "data-placeholder": placeholder ?? "",
      },
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    if (value === editor.getHTML()) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  React.useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          readOnly
            ? "w-full"
            : "w-full bg-surface-container-low border border-outline-variant rounded-xl",
          className,
        )}
        style={readOnly ? { minHeight } : { minHeight: minHeight + 50 }}
      />
    );
  }

  if (readOnly) {
    return (
      <div className={cn("w-full", className)}>
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden focus-within:border-secondary/40 focus-within:bg-surface-container-high transition-all",
        disabled && "opacity-60",
        className,
      )}
    >
      <Toolbar editor={editor} />
      <div
        className="overflow-y-auto"
        style={{ minHeight, maxHeight: Math.max(minHeight * 2, 480) }}
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
