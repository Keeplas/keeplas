import { cn } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";

/**
 * W06-8 photo stage: the current photo on a dark stage (rotated and zoomed
 * with the toolbar), then a strip of thumbnails when there are several.
 */
export function PhotoGallery({
  photos,
  current,
  onSelect,
  rotation,
  zoom,
}: {
  /** Decrypted image URLs; undefined while one decrypts. */
  photos: (string | undefined)[];
  current: number;
  onSelect: (index: number) => void;
  /** Quarter turns, clockwise. */
  rotation: number;
  zoom: number;
}) {
  const t = useTranslations("vaultItem.preview");
  const src = photos[current];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[16px]">
      <div className="flex min-h-[300px] flex-1 items-center justify-center overflow-hidden rounded-md bg-bg-header px-[25px] py-[25px]">
        {src ? (
          <img
            src={src}
            alt={t("photoOf", { photo: current + 1, total: photos.length })}
            style={{ transform: `rotate(${rotation * 90}deg) scale(${zoom})` }}
            className="max-h-full max-w-full rounded-[4px] object-contain transition-transform"
          />
        ) : (
          <span className="size-[48px] animate-pulse rounded-full bg-header-text-muted/30" />
        )}
      </div>
      {photos.length > 1 ? (
        <ol className="flex h-[56px] shrink-0 justify-center gap-[8px] overflow-x-auto">
          {photos.map((thumb, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-label={t("photoOf", {
                  photo: index + 1,
                  total: photos.length,
                })}
                aria-current={index === current ? "true" : undefined}
                className={cn(
                  "block h-[56px] w-[76px] overflow-hidden rounded-[6px] bg-bg-header focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
                  index === current
                    ? "border-2 border-border-focus"
                    : "opacity-70 hover:opacity-100",
                )}
              >
                {thumb ? (
                  <img src={thumb} alt="" className="size-full object-cover" />
                ) : null}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
