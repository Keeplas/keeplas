import type { ReactNode } from "react";
import { Button, Icon } from "@keeplas/ui";
import { ShellPage, type Crumb } from "@/components/shell/shell-page";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

/**
 * W06-2 / W06-8 / W06-9 item screen: breadcrumb, title and file summary,
 * Download and Share, then the preview beside the details panel.
 */
export function ItemLayout({
  breadcrumb,
  title,
  subtitle,
  onDownload,
  onShare,
  notice,
  preview,
  details,
}: {
  breadcrumb: Crumb[];
  title: string;
  subtitle: string;
  /** Omitted when there is no file to download (notes). */
  onDownload?: () => void;
  /** Omitted when the item can't be shared (legacy, archived). */
  onShare?: () => void;
  /** Archived banner, decryption problems. */
  notice?: ReactNode;
  preview: ReactNode;
  details: ReactNode;
}) {
  const t = useTranslations("vaultItem");
  return (
    <ShellPage
      breadcrumb={breadcrumb}
      title={title}
      subtitle={subtitle}
      actions={
        <>
          {onDownload ? (
            <Button variant="bordered" size="regular" onClick={onDownload}>
              <Icon path={ICON_PATHS.download} className="size-[16px]" />
              {t("download")}
            </Button>
          ) : null}
          {onShare ? (
            <Button variant="primary" size="regular" onClick={onShare}>
              <Icon path={ICON_PATHS.userPlus} className="size-[16px]" />
              {t("share")}
            </Button>
          ) : null}
        </>
      }
    >
      {notice}
      <div className="flex flex-col gap-[24px] lg:flex-row lg:items-stretch">
        {preview}
        {details}
      </div>
    </ShellPage>
  );
}
