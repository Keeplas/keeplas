import { useRef, useState, type ReactNode } from "react";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { FileKind } from "@keeplas/backend/lib/vault_groups";
import { Button, DropdownMenuItem, Icon, RichTextEditor } from "@keeplas/ui";
import { ShellPage, type Crumb } from "@/components/shell/shell-page";
import { ACCEPT, inferFileKind } from "@/lib/attachment-capture";
import { formatBytes, formatClock } from "@/lib/format";
import { ICON_PATHS } from "@/lib/icons";
import { useLocale, useTranslations } from "@/lib/i18n";
import type { QueuedFile } from "@/lib/upload-queue";
import type { FolderSummary } from "@/lib/vault-data";
import { extensionOf } from "@/lib/vault-list";
import type { VaultCategory } from "@/lib/vault-categories";
import { useShareableContacts } from "./access-picker";
import { FileRow } from "./file-row";
import {
  AccessField,
  CategoryField,
  EncryptionNote,
  Field,
  FolderField,
} from "./form-fields";

type ContactId = Id<"trusted_contacts">;
type FolderId = Id<"folders">;

/** A file already in the item (edit), kept unless removed. */
export interface SavedAttachment {
  id: Id<"vault_item_files">;
  kind: FileKind;
  name: string;
  detail: string;
}

export interface NoteValues {
  title: string;
  note: string;
  category: VaultCategory;
  folderId: FolderId | null;
  contactIds: ContactId[];
  /** New files to encrypt and upload. */
  added: QueuedFile[];
  /** Saved files the owner removed. */
  removed: Id<"vault_item_files">[];
}

function AttachButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button variant="bordered" size="regular" onClick={onClick}>
      <Icon path={icon} className="size-[16px]" />
      {label}
    </Button>
  );
}

const AVATAR_TONES = [
  "bg-progress-fill",
  "bg-category-note",
  "bg-category-other",
];

/**
 * W06-5 note editor: title, rich text, attachments, and the Organize panel
 * (category, folder, who can see it, when they can open it). Used to write a
 * new note, edit any item, and write the life check welcome message
 * (`welcome`: no category or folder; nobody picked = every trusted contact).
 */
export function NoteEditor({
  breadcrumb,
  heading,
  subtitle,
  welcome = false,
  initial,
  saved = [],
  folders,
  shareable = true,
  saving,
  onSave,
  onCancel,
  onScan,
  onRecordVoice,
}: {
  breadcrumb: Crumb[];
  heading: string;
  subtitle: string;
  welcome?: boolean;
  initial: Omit<NoteValues, "added" | "removed">;
  saved?: SavedAttachment[];
  folders: FolderSummary[];
  /** False for a legacy item: it can't be shared until re-keyed. */
  shareable?: boolean;
  /** Label of the save button while saving ("Saving… 42 %"). */
  saving: string | null;
  onSave: (values: NoteValues) => void;
  onCancel: () => void;
  onScan: () => void;
  /** Opens the recorder; resolves with the voice note to attach. */
  onRecordVoice: () => Promise<QueuedFile | null>;
}) {
  const t = useTranslations("vaultItem.editor");
  const lists = useTranslations("vaultList");
  const locale = useLocale();
  const contacts = useShareableContacts();
  const picker = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial.title);
  const [note, setNote] = useState(initial.note);
  const [category, setCategory] = useState(initial.category);
  const [folderId, setFolderId] = useState(initial.folderId);
  const [contactIds, setContactIds] = useState(initial.contactIds);
  const [added, setAdded] = useState<QueuedFile[]>([]);
  const [removed, setRemoved] = useState<Id<"vault_item_files">[]>([]);
  const [error, setError] = useState("");

  const folder = folders.find((candidate) => candidate.id === folderId);
  const people = [
    ...new Map([
      ...(folder?.grants ?? []).map((grant) => [
        grant.contactId,
        grant.contactName,
      ]),
      ...contacts
        .filter((contact) => contactIds.includes(contact._id))
        .map((contact) => [contact._id, contact.name]),
    ] as [string, string][]).values(),
  ];
  const kept = saved.filter((file) => !removed.includes(file.id));
  const count = kept.length + added.length;

  function pick(kind: keyof typeof ACCEPT) {
    if (!picker.current) return;
    picker.current.accept = ACCEPT[kind];
    picker.current.click();
  }

  async function recordVoice() {
    const file = await onRecordVoice();
    if (file) setAdded((current) => [...current, file]);
  }

  function save() {
    if (!title.trim()) {
      setError(t("titleRequired"));
      return;
    }
    setError("");
    onSave({
      title: title.trim(),
      note,
      category,
      folderId,
      contactIds,
      added,
      removed,
    });
  }

  const detailOf = (file: QueuedFile) => {
    if (file.kind === "audio" && file.durationSec) {
      return `${formatClock(file.durationSec)} · ${t("recordedHere")}`;
    }
    const type =
      file.kind === "image"
        ? lists("detail.photo")
        : file.kind === "video"
          ? lists("detail.video")
          : extensionOf(file.name).toUpperCase() || lists("detail.document");
    return `${type} · ${formatBytes(file.blob.size, locale)}`;
  };

  const removeItem = (onSelect: () => void): ReactNode => (
    <DropdownMenuItem
      onSelect={onSelect}
      className="rounded-sm px-[10px] py-[8px] text-body-sm text-action-danger focus:bg-bg-danger"
    >
      {t("remove")}
    </DropdownMenuItem>
  );

  return (
    <ShellPage
      breadcrumb={breadcrumb}
      title={heading}
      subtitle={subtitle}
      actions={
        <>
          <Button variant="plain" size="regular" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            size="regular"
            onClick={save}
            disabled={saving !== null}
          >
            <Icon path={ICON_PATHS.check} className="size-[16px]" />
            {saving ?? t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[24px] lg:flex-row">
        <section className="flex min-h-[713px] min-w-0 flex-1 flex-col gap-[16px] rounded-[20px] border border-border-default bg-bg-surface px-[32px] py-[28px]">
          <label className="sr-only" htmlFor="note-title">
            {t("titleLabel")}
          </label>
          <input
            id="note-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("titlePlaceholder")}
            className="w-full bg-transparent font-serif text-[28px] leading-[34px] font-semibold text-text-primary placeholder:text-text-subtle focus:outline-none"
          />
          {error ? (
            <p role="alert" className="text-body-sm text-action-danger">
              {error}
            </p>
          ) : null}
          <RichTextEditor
            value={note}
            onChange={setNote}
            placeholder={t("notePlaceholder")}
            minHeight={160}
            toolbarLabels={{
              bold: t("tools.bold"),
              italic: t("tools.italic"),
              heading1: t("tools.heading1"),
              heading2: t("tools.heading2"),
              list: t("tools.list"),
            }}
          />

          <div className="flex items-center justify-between pt-[8px]">
            <h2 className="text-[15px] leading-[20px] font-semibold text-text-primary">
              {t("attachments", { count })}
            </h2>
            <button
              type="button"
              onClick={() => pick("any")}
              className="flex items-center gap-[4px] rounded-xs text-[13px] leading-[18px] font-semibold text-text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <Icon path={ICON_PATHS.plus} className="size-[16px]" />
              {t("add")}
            </button>
          </div>
          {kept.length + added.length > 0 ? (
            <div className="flex flex-col gap-[10px]">
              {kept.map((file) => (
                <FileRow
                  key={file.id}
                  kind={file.kind}
                  name={file.name}
                  detail={file.detail}
                  menu={removeItem(() =>
                    setRemoved((current) => [...current, file.id]),
                  )}
                />
              ))}
              {added.map((file, index) => (
                <FileRow
                  key={`${file.name}-${index}`}
                  kind={file.kind}
                  name={file.name}
                  detail={detailOf(file)}
                  menu={removeItem(() =>
                    setAdded((current) =>
                      current.filter((_, at) => at !== index),
                    ),
                  )}
                />
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-[8px]">
            <AttachButton
              icon={ICON_PATHS.qr}
              label={t("attach.scan")}
              onClick={onScan}
            />
            <AttachButton
              icon={ICON_PATHS.photo}
              label={t("attach.photo")}
              onClick={() => pick("photo")}
            />
            <AttachButton
              icon={ICON_PATHS.mic}
              label={t("attach.voice")}
              onClick={() => void recordVoice()}
            />
            <AttachButton
              icon={ICON_PATHS.document}
              label={t("attach.file")}
              onClick={() => pick("document")}
            />
            <AttachButton
              icon={ICON_PATHS.video}
              label={t("attach.video")}
              onClick={() => pick("video")}
            />
          </div>
          <input
            ref={picker}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              setAdded((current) => [
                ...current,
                ...files.map((file) => ({
                  blob: file,
                  name: file.name,
                  mimeType: file.type || "application/octet-stream",
                  kind: inferFileKind(file.type),
                })),
              ]);
            }}
          />
        </section>

        <aside className="flex w-full flex-col gap-[16px] rounded-[20px] border border-border-default bg-bg-surface p-[20px] lg:w-[360px] lg:shrink-0">
          <h2 className="text-h3 text-text-primary">{t("organize")}</h2>
          {welcome ? null : (
            <>
              <CategoryField value={category} onChange={setCategory} />
              <FolderField
                value={folderId}
                onChange={setFolderId}
                folders={folders}
              />
            </>
          )}
          {shareable ? (
            <AccessField
              value={contactIds}
              onChange={setContactIds}
              folder={folder}
              emptyLabel={welcome ? t("everyone") : undefined}
            />
          ) : (
            <EncryptionNote>{t("legacy")}</EncryptionNote>
          )}
          <Field label={t("whenLabel")}>
            {(id) => (
              <div
                id={id}
                className="flex h-[46px] items-center rounded-sm border border-border-default bg-bg-subtle px-[14px] text-[15px] leading-[22px] text-text-primary"
              >
                {t("afterLifeCheck")}
              </div>
            )}
          </Field>
          {people.length > 0 ? (
            <div className="flex items-center gap-[10px]">
              <span className="flex -space-x-[8px]">
                {people.slice(0, 3).map((name, index) => (
                  <span
                    key={`${name}-${index}`}
                    className={`flex size-[32px] items-center justify-center rounded-full border-2 border-bg-surface text-[13px] leading-[18px] font-semibold text-text-inverse ${AVATAR_TONES[index]}`}
                  >
                    {name.charAt(0).toLocaleUpperCase(locale)}
                  </span>
                ))}
              </span>
              <span className="text-[13px] leading-[18px] font-medium text-text-body">
                {people.length === 1
                  ? t("peopleOne")
                  : t("people", { count: people.length })}
              </span>
            </div>
          ) : null}
          <EncryptionNote>{t("encrypted")}</EncryptionNote>
        </aside>
      </div>
    </ShellPage>
  );
}
