import { useRef, useState, type DragEvent } from "react";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { Button, cn, DropdownMenuItem, Icon, Input } from "@keeplas/ui";
import { Modal } from "@/components/v2/modal";
import {
  ACCEPT,
  acceptsFile,
  inferFileKind,
  MAX_FILE_BYTES,
  type CaptureKind,
} from "@/lib/attachment-capture";
import { formatBytes } from "@/lib/format";
import { ICON_PATHS } from "@/lib/icons";
import { useLocale, useTranslations } from "@/lib/i18n";
import type { FolderSummary } from "@/lib/vault-data";
import { extensionOf } from "@/lib/vault-list";
import type { VaultCategory } from "@/lib/vault-categories";
import { FileRow } from "./file-row";
import {
  AccessField,
  CategoryField,
  EncryptionNote,
  Field,
  FolderField,
} from "./form-fields";

export interface AddFileValues {
  files: File[];
  /** The item title when there is one file; else each file's name. */
  title: string;
  category: VaultCategory;
  folderId: Id<"folders"> | null;
  contactIds: Id<"trusted_contacts">[];
}

const KIND_LABEL = { image: "photo", audio: "voice", video: "video" } as const;

interface Screened {
  accepted: File[];
  /** The first file turned down, and why. */
  error: { name: string; reason: "type" | "size" } | null;
}

/** Keeps the files this dialog takes (type for its kind, 100 MB max). */
function screen(list: File[], kind: CaptureKind): Screened {
  const accepted: File[] = [];
  let error: Screened["error"] = null;
  for (const file of list) {
    const reason = !acceptsFile(
      file,
      kind === "document" ? ACCEPT.any : ACCEPT[kind],
    )
      ? "type"
      : file.size > MAX_FILE_BYTES
        ? "size"
        : null;
    if (reason) error ??= { name: file.name, reason };
    else accepted.push(file);
  }
  return { accepted, error };
}

/** "Home insurance policy.pdf" → "Home insurance policy". */
export const titleOf = (name: string) => name.replace(/\.[^.]+$/, "");

/**
 * W06-3 "Add a document" (or a photo, a video): drop or browse, then the
 * title and where it goes. Each file becomes its own item, encrypted in this
 * browser before upload.
 */
export function AddFileDialog({
  open,
  onOpenChange,
  kind,
  initialFiles,
  defaultCategory,
  folders,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: CaptureKind;
  initialFiles: File[];
  defaultCategory: VaultCategory;
  folders: FolderSummary[];
  onSubmit: (values: AddFileValues) => Promise<void>;
}) {
  const t = useTranslations("vaultItem.addFile");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t(`${kind}.title`)}
      description={t("description")}
      width="w-[600px]"
    >
      {/* Mounted while open only: each opening starts a new form. */}
      <AddFileForm
        kind={kind}
        initialFiles={initialFiles}
        defaultCategory={defaultCategory}
        folders={folders}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Modal>
  );
}

function AddFileForm({
  kind,
  initialFiles,
  defaultCategory,
  folders,
  onSubmit,
  onCancel,
}: {
  kind: CaptureKind;
  initialFiles: File[];
  defaultCategory: VaultCategory;
  folders: FolderSummary[];
  onSubmit: (values: AddFileValues) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("vaultItem.addFile");
  const lists = useTranslations("vaultList");
  const common = useTranslations("common");
  const locale = useLocale();
  const input = useRef<HTMLInputElement>(null);
  const accept = ACCEPT[kind];
  const [initial] = useState(() => screen(initialFiles, kind));
  const [files, setFiles] = useState<File[]>(initial.accepted);
  const [error, setError] = useState(initial.error);
  const [title, setTitle] = useState(
    initial.accepted.length === 1 ? titleOf(initial.accepted[0].name) : "",
  );
  const [category, setCategory] = useState(defaultCategory);
  const [folderId, setFolderId] = useState<Id<"folders"> | null>(null);
  const [contactIds, setContactIds] = useState<Id<"trusted_contacts">[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const errorText = (problem: Screened["error"]) =>
    problem === null
      ? ""
      : problem.reason === "type"
        ? t("errors.type", { name: problem.name })
        : t("errors.size", {
            name: problem.name,
            max: formatBytes(MAX_FILE_BYTES, locale),
          });

  function add(list: File[]) {
    const { accepted, error: problem } = screen(list, kind);
    setError(problem);
    if (accepted.length === 0) return;
    const next = [...files, ...accepted];
    setFiles(next);
    if (next.length === 1) setTitle(titleOf(next[0].name));
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    add(Array.from(event.dataTransfer.files));
  }

  async function submit() {
    if (files.length === 0) {
      input.current?.click();
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ files, title, category, folderId, contactIds });
    } finally {
      setSaving(false);
    }
  }

  const detail = (file: File) => {
    const fileKind = inferFileKind(file.type);
    const type =
      fileKind === "document"
        ? extensionOf(file.name).toUpperCase() || lists("detail.document")
        : lists(`detail.${KIND_LABEL[fileKind]}`);
    return [type, formatBytes(file.size, locale), t("ready")].join(" · ");
  };

  return (
    <>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn(
          "flex flex-col items-center gap-[8px] rounded-[20px] border-[1.5px] border-dashed border-progress-fill px-[24px] py-[28px] text-center",
          dragging ? "bg-bg-info" : "bg-bg-app",
        )}
      >
        <span className="flex size-[52px] items-center justify-center rounded-full bg-bg-accent text-text-accent">
          <Icon path={ICON_PATHS.cloudUpload} className="size-[24px]" />
        </span>
        <p className="pt-[6px] text-[15px] leading-[22px] font-semibold text-text-primary">
          {t("drop")}{" "}
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="rounded-xs text-text-accent underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            {t("browse")}
          </button>
        </p>
        <p className="text-body-sm text-text-muted">
          {t(`${kind}.hint`, { max: formatBytes(MAX_FILE_BYTES, locale) })}
        </p>
        <input
          ref={input}
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            add(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>

      {error ? (
        <p role="alert" className="text-body-sm text-action-danger">
          {errorText(error)}
        </p>
      ) : null}

      {files.map((file, index) => (
        <FileRow
          key={`${file.name}-${index}`}
          kind={inferFileKind(file.type)}
          name={file.name}
          detail={detail(file)}
          menu={
            <DropdownMenuItem
              onSelect={() =>
                setFiles((current) => current.filter((_, at) => at !== index))
              }
              className="rounded-sm px-[10px] py-[8px] text-body-sm text-action-danger focus:bg-bg-danger"
            >
              {t("remove")}
            </DropdownMenuItem>
          }
        />
      ))}

      {files.length <= 1 ? (
        <Field label={t("title")}>
          {(id) => (
            <Input
              id={id}
              variant="field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("titlePlaceholder")}
            />
          )}
        </Field>
      ) : null}
      <div className="grid gap-[16px] sm:grid-cols-2">
        <CategoryField value={category} onChange={setCategory} />
        <FolderField
          value={folderId}
          onChange={setFolderId}
          folders={folders}
        />
      </div>
      <AccessField value={contactIds} onChange={setContactIds} />
      <EncryptionNote>{t("encrypted")}</EncryptionNote>

      <div className="flex items-center gap-[12px]">
        <p className="flex-1 text-body-sm text-text-muted">
          {files.length > 1
            ? t("eachItem", { count: files.length })
            : t("moreAfter")}
        </p>
        <Button variant="plain" size="regular" onClick={onCancel}>
          {common("cancel")}
        </Button>
        <Button
          variant="primary"
          size="regular"
          onClick={() => void submit()}
          disabled={saving}
        >
          <Icon path={ICON_PATHS.lock} className="size-[16px]" />
          {t("submit")}
        </Button>
      </div>
    </>
  );
}
