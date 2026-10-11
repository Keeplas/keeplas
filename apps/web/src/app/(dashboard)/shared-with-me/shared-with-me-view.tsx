import { Fragment, type ReactNode } from "react";
import { ShellPage } from "@/components/shell/shell-page";
import { StateMessage } from "@/components/state-message";
import { ItemTable } from "@/components/v2/item-table";
import { IconTile, Panel } from "@/components/v2/surface";
import { formatDate } from "@/lib/format";
import { ICON_PATHS } from "@/lib/icons";
import { useLocale, useTranslations } from "@/lib/i18n";
import { getInitials } from "@/lib/user";

export interface SharedFile {
  id: string;
  title: string;
  /** "PDF · 1.2 MB", empty for an item without attachment. */
  detail: string;
  updatedAt: number;
}

export interface SharedFolder {
  id: string;
  name: string;
  ownerName: string;
  /** Open now, or waiting for verification + the 72 h grace period. */
  available: boolean;
  files: SharedFile[];
}

/**
 * W04-4 recipient view: each folder shared with me ("this folder only",
 * view and download), then the folders still locked until verification.
 */
export function SharedWithMeView({
  folders,
  onDownload,
  footer,
}: {
  folders: SharedFolder[];
  onDownload: (folderId: string, fileId: string) => void;
  /** Vaults where I am a trust contact (legacy release flow). */
  footer?: ReactNode;
}) {
  const t = useTranslations("sharedWithMe.folders");
  const locale = useLocale();
  const open = folders.filter((folder) => folder.available);
  const locked = folders.filter((folder) => !folder.available);

  return (
    <ShellPage title={t("title")} subtitle={t("subtitle")}>
      {folders.length === 0 ? (
        <Panel className="flex justify-center">
          <StateMessage
            icon={ICON_PATHS.inbox}
            title={t("empty.title")}
            body={t("empty.body")}
          />
        </Panel>
      ) : null}

      {open.map((folder) => (
        <Fragment key={folder.id}>
          <Panel className="flex items-center gap-[16px] p-[20px]">
            <div className="flex min-w-0 flex-1 items-center gap-[12px]">
              <span className="flex size-[44px] shrink-0 items-center justify-center rounded-full bg-action-primary text-label text-text-inverse">
                {getInitials(folder.ownerName, 1)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <h2 className="truncate text-h3 text-text-primary">
                  {folder.name}
                </h2>
                <p className="text-body-sm text-text-muted">
                  {t("sharedBy", { name: folder.ownerName })}
                </p>
              </div>
            </div>
            <div className="flex flex-col rounded-sm bg-bg-accent px-[14px] py-[8px]">
              <span className="text-caption text-text-muted">
                {t("permission")}
              </span>
              <span className="text-label text-text-primary">{t("view")}</span>
            </div>
          </Panel>
          {folder.files.length > 0 ? (
            <ItemTable
              headers={[t("name"), t("size"), t("updated")]}
              columns="grid-cols-[minmax(0,1fr)_220px_260px_54px]"
              iconClassName="text-action-danger"
              rows={folder.files.map((file) => ({
                id: file.id,
                name: file.title,
                details: [file.detail, formatDate(file.updatedAt, locale)],
                actions: [
                  {
                    label: t("download"),
                    onSelect: () => onDownload(folder.id, file.id),
                  },
                ],
              }))}
            />
          ) : null}
        </Fragment>
      ))}

      {locked.map((folder) => (
        <section
          key={folder.id}
          className="flex items-center gap-[12px] rounded-[16px] border border-border-default bg-bg-subtle p-[20px]"
        >
          <IconTile
            icon={ICON_PATHS.lock}
            className="bg-bg-surface text-text-link"
          />
          <div className="flex min-w-0 flex-col gap-[2px]">
            <p className="text-label text-text-primary">{t("locked.title")}</p>
            <p className="text-body-sm text-text-muted">
              {t("locked.body", {
                name: folder.name,
                owner: folder.ownerName,
              })}
            </p>
          </div>
        </section>
      ))}

      {footer}
    </ShellPage>
  );
}
