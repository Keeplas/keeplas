"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "./lib/utils";

export interface RichTextToolbarLabels {
  bold: string;
  italic: string;
  heading1: string;
  heading2: string;
  list: string;
}

const ENGLISH: RichTextToolbarLabels = {
  bold: "Bold",
  italic: "Italic",
  heading1: "Heading 1",
  heading2: "Heading 2",
  list: "List",
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
  /** Translated toolbar names (aria labels, and the List button). */
  toolbarLabels?: RichTextToolbarLabels;
  /** Right end of the toolbar (W06-5: "Draft encrypted · 10:24 AM"). */
  toolbarEnd?: React.ReactNode;
}

/** Figma W06-5 format tool: a 28 px text chip, subtle when active. */
function Tool({
  onClick,
  active,
  label,
  children,
  className,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "rounded-[6px] px-[10px] py-[5px] text-[13px] leading-[18px] text-text-body hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
        active && "bg-bg-subtle",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({
  editor,
  labels,
  end,
}: {
  editor: Editor;
  labels: RichTextToolbarLabels;
  end?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-[6px] border-b border-border-default pb-[12px]">
      <Tool
        label={labels.bold}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        className="font-semibold"
      >
        B
      </Tool>
      <Tool
        label={labels.italic}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className="italic"
      >
        I
      </Tool>
      <Tool
        label={labels.heading1}
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className="font-semibold"
      >
        H1
      </Tool>
      <Tool
        label={labels.heading2}
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className="font-semibold"
      >
        H2
      </Tool>
      <Tool
        label={labels.list}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className="font-medium"
      >
        •&nbsp;&nbsp;{labels.list}
      </Tool>
      {end ? <span className="ml-auto">{end}</span> : null}
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
  toolbarLabels = ENGLISH,
  toolbarEnd,
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
          "tiptap-content max-w-none focus:outline-none",
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
    return <div className={cn("w-full", className)} style={{ minHeight }} />;
  }

  if (readOnly) {
    return (
      <div className={cn("w-full", className)}>
        <EditorContent editor={editor} />
      </div>
    );
  }

  // v2 (W06-5): the toolbar, then the text; the screen draws the card.
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-[16px]",
        disabled && "opacity-60",
        className,
      )}
    >
      <Toolbar editor={editor} labels={toolbarLabels} end={toolbarEnd} />
      <div
        className="cursor-text"
        style={{ minHeight }}
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
