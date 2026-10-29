import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  bucketOf,
  contentKind,
  type VaultListKey,
} from "@keeplas/backend/lib/vault_groups";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  InfoCallout,
  Loader,
  RichTextEditor,
  useConfirm,
} from "@keeplas/ui";
import { StateMessage } from "@/components/state-message";
import { AccessDialog } from "@/components/vault/access-picker";
import {
  DetailRow,
  DetailsPanel,
  type ActivityEntry,
} from "@/components/vault/details-panel";
import { FileRow } from "@/components/vault/file-row";
import { HistorySheet } from "@/components/vault/history-sheet";
import { ItemUnavailable } from "@/components/vault/item-unavailable";
import { DocumentPages } from "@/components/vault/preview/document-pages";
import {
  MediaPlayer,
  StreamNote,
} from "@/components/vault/preview/media-player";
import {
  Pager,
  PreviewPanel,
  ToolbarButton,
  ZoomControl,
} from "@/components/vault/preview/preview-panel";
import { PhotoGallery } from "@/components/vault/preview/photo-gallery";
import { usePdfPages } from "@/components/vault/preview/use-pdf-pages";
import { formatDate, formatDayTime } from "@/lib/format";
import { ICON_PATHS } from "@/lib/icons";
import { useLocale, useTranslations } from "@/lib/i18n";
import {
  choiceKey,
  choiceOf,
  CUSTOM_FALLBACK,
  itemMetaJson,
  type CategoryChoice,
} from "@/lib/item-meta";
import { safeLinkHref } from "@/lib/link-payload";
import { normalizeContentForRichText } from "@/lib/normalize-content-for-rich-text";
import { useParams, useRouter } from "@/lib/navigation";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useSortedCategories, useCategoryLabel } from "@/lib/use-categories";
import { useDecryptedFiles } from "@/lib/use-decrypted-files";
import { useItemLabels } from "@/lib/use-item-labels";
import { sharingFields, useItemSharing } from "@/lib/use-item-sharing";
import { summaryOf, useOpenedItem } from "@/lib/use-opened-item";
import type { OpenedFile } from "@/lib/use-opened-files";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { useVaultData } from "@/lib/vault-data";
import { extensionOf } from "@/lib/vault-list";
import { ItemLayout } from "./item-layout";

type ContactId = Id<"trusted_contacts">;

/** W06-2 / W06-8 / W06-9: an item, its preview and its details. */
export default function VaultItemPage() {
  const params = useParams();
  const itemId = params.itemId as Id<"vault_items">;
  const t = useTranslations("vaultItem");
  const lists = useTranslations("vaultList");
  const locale = useLocale();
  const router = useRouter();
  const confirm = useConfirm();
  const categoryLabel = useCategoryLabel();
  const categories = useSortedCategories();
  const labels = useItemLabels();
  const { categories: custom } = useVaultData();
  const { raw, opened, files, failed } = useOpenedItem(itemId);
  const versions = useQuery(api.vault_items.getItemVersions, { itemId });
  const { decryptContent, decryptContentWithKey, encryptContentWithKey } =
    useVaultCrypto();
  const { wrap, announcePending } = useItemSharing();
  const updateItem = useAuditedMutation(api.vault_items.updateItem);
  const archiveItem = useAuditedMutation(api.vault_items.archiveItem);
  const unarchiveItem = useAuditedMutation(api.vault_items.unarchiveItem);

  const [selected, setSelected] = useState(0);
  const [showNote, setShowNote] = useState(true);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [history, setHistory] = useState(false);

  const kind = files ? contentKind(files) : undefined;
  const isNote = kind === "notes";
  const file: OpenedFile | undefined =
    files && !(isNote && showNote) ? files[selected] : undefined;
  const photos = useMemo(
    () => (files ?? []).filter((candidate) => candidate.kind === "image"),
    [files],
  );
  const wanted = useMemo(() => {
    if (!file) return [];
    return file.kind === "image"
      ? photos.map((photo) => photo._id)
      : [file._id];
  }, [file, photos]);
  const decrypted = useDecryptedFiles(
    files,
    wanted,
    opened?.key,
    opened?.legacy ?? false,
  );
  const current = file ? decrypted.get(file._id) : undefined;
  const isPdf =
    file?.kind === "document" &&
    (file.mimeType === "application/pdf" || extensionOf(file.name) === "pdf");
  const pdf = usePdfPages(
    isPdf && current?.status === "ready" ? current.blob : null,
    page,
    zoom,
  );

  const decrypt = useCallback(
    (payload: string) =>
      opened?.legacy || !opened
        ? decryptContent(payload)
        : decryptContentWithKey(payload, opened.key),
    [opened, decryptContent, decryptContentWithKey],
  );

  const summary = useMemo(
    () => (raw && opened && files ? summaryOf(raw, opened, files) : undefined),
    [raw, opened, files],
  );

  const activity = useMemo<ActivityEntry[]>(() => {
    if (!raw) return [];
    const you = t("activity.you");
    const entries: (ActivityEntry & { at: number })[] = [
      {
        id: "added",
        title: t("activity.added"),
        at: raw.createdAt,
        when: "",
        actor: you,
      },
      ...(files ?? [])
        .filter((attached) => attached.createdAt - raw.createdAt > 60_000)
        .map((attached) => ({
          id: attached._id,
          title: t("activity.attached", { name: attached.name }),
          at: attached.createdAt,
          when: "",
          actor: you,
        })),
      ...(versions ?? []).map((version) => ({
        id: version._id,
        title: t("activity.edited"),
        at: version.replacedAt,
        when: "",
        actor: you,
      })),
    ];
    return entries
      .sort((a, b) => b.at - a.at)
      .slice(0, 4)
      .map(({ at, ...entry }) => ({
        ...entry,
        when: formatDayTime(at, locale),
      }));
  }, [raw, files, versions, t, locale]);

  if (raw === undefined || (raw && !opened && !failed)) return <Loader />;

  if (raw === null || failed || !opened || !summary) {
    return <ItemUnavailable missing={raw === null} />;
  }

  const archived = raw.status === "archived";
  const recipients = labels.recipients(summary);
  const list: VaultListKey = bucketOf(summary);
  const access = labels.access(summary);
  // The picker starts from who can see it: wait until people are loaded.
  const canShare = !archived && !opened.legacy && labels.ready;

  async function share(contactIds: ContactId[]) {
    // Unchanged: keep v1 group and "every trusted contact" shares as they are.
    if (
      contactIds.length === recipients.length &&
      contactIds.every((id) => recipients.includes(id))
    ) {
      return;
    }
    const wraps = await wrap(contactIds, opened!.key);
    if (!wraps) throw new Error("Sharing cancelled");
    await updateItem({
      itemId,
      ...sharingFields(contactIds),
      recipientKeys: wraps.recipientKeys,
      pendingRecipients: wraps.pendingRecipients,
    });
    announcePending(wraps);
  }

  async function recategorize(choice: CategoryChoice) {
    if (choiceKey(choice) === choiceKey(opened!)) return;
    const meta = itemMetaJson(choice.category, opened!.icon, choice.categoryId);
    // The item key: its DEK, or the master key for a legacy item.
    await updateItem({
      itemId,
      encryptedMeta: await encryptContentWithKey(meta, opened!.key),
    });
  }

  async function archive() {
    const ok = await confirm({
      title: t("archive.title"),
      description: t("archive.body"),
      confirmLabel: t("archive.confirm"),
      cancelLabel: t("archive.cancel"),
    });
    if (!ok) return;
    await archiveItem({ itemId });
    router.push("/vault");
  }

  function download() {
    if (current?.status !== "ready" || !file) return;
    const link = document.createElement("a");
    link.href = current.url;
    link.download = file.name;
    link.click();
  }

  const photoIndex = file?.kind === "image" ? photos.indexOf(file) : -1;
  const selectFile = (target: OpenedFile) => {
    setSelected(files!.indexOf(target));
    setShowNote(false);
    setPage(0);
    setZoom(1);
    setRotation(0);
  };

  const noteText = opened.note.trim();
  const noteBlock = noteText ? (
    <RichTextEditor readOnly value={normalizeContentForRichText(opened.note)} />
  ) : null;

  let start: ReactNode;
  let tools: ReactNode = null;
  let body: ReactNode;
  if (!file) {
    start = (
      <span className="text-[13px] leading-[18px] font-medium text-text-body">
        {t("preview.note")}
      </span>
    );
    body = (
      <div className="flex flex-col gap-[16px] overflow-y-auto">
        <article className="rounded-md border border-border-default bg-bg-surface px-[32px] py-[28px] text-body text-text-body">
          {noteBlock ?? (
            <p className="text-text-muted">{t("preview.emptyNote")}</p>
          )}
          {opened.links.length > 0 ? (
            <ul className="mt-[16px] flex flex-col gap-[6px]">
              {opened.links.map((url) => {
                const href = safeLinkHref(url);
                return (
                  <li key={url}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="break-all text-text-link underline"
                      >
                        {url}
                      </a>
                    ) : (
                      <span className="break-all">{url}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </article>
        {files!.map((attached) => (
          <FileRow
            key={attached._id}
            kind={attached.kind}
            name={attached.name}
            detail={labels.detail({
              ...summary,
              kind: contentKind([attached]),
              files: [attached],
            })}
            onOpen={() => selectFile(attached)}
          />
        ))}
      </div>
    );
  } else {
    const back = isNote ? (
      <Button variant="plain" size="compact" onClick={() => setShowNote(true)}>
        {t("preview.backToNote")}
      </Button>
    ) : null;
    if (file.kind === "image") {
      start = (
        <>
          {back}
          <Pager
            label={
              photos.length > 1
                ? t("preview.photoOf", {
                    photo: photoIndex + 1,
                    total: photos.length,
                  })
                : t("preview.photo")
            }
            onPrevious={
              photoIndex > 0
                ? () => selectFile(photos[photoIndex - 1])
                : undefined
            }
            onNext={
              photoIndex < photos.length - 1
                ? () => selectFile(photos[photoIndex + 1])
                : undefined
            }
          />
        </>
      );
      tools = (
        <>
          <ToolbarButton
            icon={ICON_PATHS.rotate}
            label={t("preview.rotate")}
            onClick={() => setRotation((turns) => (turns + 1) % 4)}
          />
          <ZoomControl zoom={zoom} onZoom={setZoom} />
        </>
      );
      body = (
        <PhotoGallery
          photos={photos.map((photo) => {
            const entry = decrypted.get(photo._id);
            return entry?.status === "ready" ? entry.url : undefined;
          })}
          current={photoIndex}
          onSelect={(index) => selectFile(photos[index])}
          rotation={rotation}
          zoom={zoom}
        />
      );
    } else if (file.kind === "video" || file.kind === "audio") {
      start = (
        <>
          {back}
          <span className="text-[13px] leading-[18px] font-medium text-text-body">
            {labels.detail({
              ...summary,
              kind: contentKind([file]),
              files: [file],
            })}
          </span>
        </>
      );
      body = (
        <div className="flex flex-col gap-[16px]">
          <MediaPlayer
            key={file._id}
            kind={file.kind}
            src={current?.status === "ready" ? current.url : undefined}
            durationSec={file.durationSec}
          />
          {noteBlock ? (
            <div className="text-[14px] leading-[21px] text-text-body">
              {noteBlock}
            </div>
          ) : null}
          <StreamNote />
        </div>
      );
    } else if (isPdf) {
      start = (
        <>
          {back}
          <Pager
            label={t("preview.pageOf", {
              page: page + 1,
              total: Math.max(1, pdf.thumbnails.length),
            })}
            onPrevious={page > 0 ? () => setPage(page - 1) : undefined}
            onNext={
              page < pdf.thumbnails.length - 1
                ? () => setPage(page + 1)
                : undefined
            }
          />
        </>
      );
      tools = <ZoomControl zoom={zoom} onZoom={setZoom} />;
      body = pdf.error ? (
        <InfoCallout icon={ICON_PATHS.alertTriangle}>
          {t("preview.pdfError")}
        </InfoCallout>
      ) : (
        <DocumentPages
          thumbnails={pdf.thumbnails}
          current={page}
          onSelect={setPage}
          page={pdf.page}
          zoom={zoom}
        />
      );
    } else {
      start = back;
      body = (
        <div className="flex flex-1 items-center justify-center">
          <StateMessage
            icon={ICON_PATHS.document}
            title={file.name}
            body={t("preview.noPreview", {
              type: extensionOf(file.name).toUpperCase() || file.mimeType,
            })}
          >
            <Button
              variant="primary"
              size="cta"
              className="w-full"
              onClick={download}
              disabled={current?.status !== "ready"}
            >
              {t("download")}
            </Button>
          </StateMessage>
        </div>
      );
    }
    if (current?.status === "error") {
      body = (
        <InfoCallout icon={ICON_PATHS.alertTriangle}>
          {t("preview.decryptError")}
        </InfoCallout>
      );
    }
  }

  const title = labels.title(summary);
  return (
    <>
      <ItemLayout
        breadcrumb={[
          { label: lists("breadcrumb"), href: "/hub" },
          { label: lists(`lists.${list}`), href: `/vault?type=${list}` },
          { label: file?.name ?? title },
        ]}
        title={title}
        subtitle={`${labels.detail(summary)} · ${t("added", {
          date: formatDate(raw.createdAt, locale),
        })}`}
        onDownload={file ? download : undefined}
        onShare={canShare ? () => setSharing(true) : undefined}
        notice={
          archived ? (
            <div className="flex items-center gap-[16px] rounded-md bg-bg-pending px-[16px] py-[12px] text-body text-text-pending">
              <span className="flex-1">
                {t("archived", {
                  date: formatDate(raw.archivedAt ?? raw.updatedAt, locale),
                })}
              </span>
              <Button
                variant="bordered"
                size="compact"
                onClick={() => void unarchiveItem({ itemId })}
              >
                {t("restore")}
              </Button>
            </div>
          ) : opened.legacy ? (
            <InfoCallout icon={ICON_PATHS.info}>{t("legacy")}</InfoCallout>
          ) : null
        }
        preview={
          <PreviewPanel
            start={start}
            tools={tools}
            hidden={hidden}
            onToggleHidden={() => setHidden(!hidden)}
            menu={
              <>
                <DropdownMenuItem
                  onSelect={() => setHistory(true)}
                  className="rounded-sm px-[10px] py-[8px] text-body-sm text-text-primary focus:bg-bg-subtle"
                >
                  {t("history.title")}
                </DropdownMenuItem>
                {archived ? null : (
                  <DropdownMenuItem
                    onSelect={() => void archive()}
                    className="rounded-sm px-[10px] py-[8px] text-body-sm text-action-danger focus:bg-bg-danger"
                  >
                    {t("archive.confirm")}
                  </DropdownMenuItem>
                )}
              </>
            }
          >
            {body}
          </PreviewPanel>
        }
        details={
          <DetailsPanel
            onEdit={
              archived ? undefined : () => router.push(`/vault/${itemId}/edit`)
            }
            onAddPeople={canShare ? () => setSharing(true) : undefined}
            activity={activity}
            onSeeAll={() => setHistory(true)}
            rows={
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={archived}>
                    <DetailRow
                      icon={ICON_PATHS.document}
                      label={t("details.category")}
                      value={labels.category(summary)}
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="max-h-[360px] min-w-[220px] overflow-y-auto rounded-md border border-border-default bg-bg-surface p-[6px] shadow-menu"
                  >
                    <DropdownMenuRadioGroup
                      value={choiceKey(summary)}
                      onValueChange={(value) =>
                        void recategorize(choiceOf(value))
                      }
                    >
                      {categories.map((category) => (
                        <DropdownMenuRadioItem
                          key={category.key}
                          value={category.key}
                          className="rounded-sm text-body-sm text-text-primary"
                        >
                          {categoryLabel(category.key)}
                        </DropdownMenuRadioItem>
                      ))}
                      {(custom ?? []).map((category) => (
                        <DropdownMenuRadioItem
                          key={category.id}
                          value={choiceKey({
                            category: CUSTOM_FALLBACK,
                            categoryId: category.id,
                          })}
                          className="rounded-sm text-body-sm text-text-primary"
                        >
                          {category.name ?? t("details.lockedCategory")}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DetailRow
                  icon={ICON_PATHS.lock}
                  label={t("details.access")}
                  value={access.label}
                  onClick={() => setSharing(true)}
                  disabled={!canShare}
                />
              </>
            }
          />
        }
      />
      <AccessDialog
        open={sharing}
        onOpenChange={setSharing}
        initial={recipients}
        onSave={share}
      />
      <HistorySheet
        open={history}
        onOpenChange={setHistory}
        itemId={itemId}
        decrypt={decrypt}
        canRestore={!archived}
      />
    </>
  );
}
