import { cn } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";

/** A page rendered to an image, with its size at 100 % (CSS px). */
export interface PageImage {
  src: string;
  width: number;
  height: number;
}

/**
 * W06-2 pages: a column of page thumbnails beside the current page, which
 * scales with the zoom and scrolls when larger than the canvas.
 */
export function DocumentPages({
  thumbnails,
  current,
  onSelect,
  page,
  zoom,
}: {
  /** One per page; undefined while that thumbnail renders. */
  thumbnails: (string | undefined)[];
  current: number;
  onSelect: (index: number) => void;
  page: PageImage | undefined;
  zoom: number;
}) {
  const t = useTranslations("vaultItem.preview");
  return (
    <div className="flex min-h-0 flex-1 gap-[20px]">
      {thumbnails.length > 1 ? (
        <ol className="flex w-[64px] shrink-0 flex-col gap-[12px] overflow-y-auto">
          {thumbnails.map((src, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-label={t("pageOf", {
                  page: index + 1,
                  total: thumbnails.length,
                })}
                aria-current={index === current ? "page" : undefined}
                className={cn(
                  "block h-[84px] w-[64px] overflow-hidden rounded-[6px] bg-bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
                  index === current
                    ? "border-2 border-border-focus"
                    : "border border-border-default",
                )}
              >
                {src ? (
                  <img src={src} alt="" className="size-full object-cover" />
                ) : null}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex min-w-0 flex-1 justify-center overflow-auto">
        {page ? (
          <img
            src={page.src}
            alt={t("pageOf", { page: current + 1, total: thumbnails.length })}
            style={{ width: page.width * zoom, height: page.height * zoom }}
            className="max-w-none shrink-0 self-start rounded-[6px] shadow-card"
          />
        ) : (
          <div className="h-[545px] w-[470px] animate-pulse rounded-[6px] bg-bg-surface" />
        )}
      </div>
    </div>
  );
}
