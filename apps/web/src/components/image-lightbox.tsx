import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
  DialogTitle,
  Icon,
  cn,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

/**
 * Click-to-enlarge wrapper for a decrypted image attachment. The thumbnail is
 * the dialog trigger; opening it shows the full-resolution image in a
 * near-fullscreen overlay. Used by both the owner (vault) and contact
 * (memorial) attachment cards, so the markup lives here once.
 *
 * The trigger can be restyled via `triggerClassName`/`imgClassName` (e.g. the
 * grid view passes a square `object-cover` thumbnail). When `downloadUrl` is
 * provided, the modal shows a download control next to the close button — used
 * by the grid view, where the thumbnail has no header download link.
 */
export function ImageLightbox({
  src,
  alt,
  enlargeLabel,
  closeLabel,
  triggerClassName,
  imgClassName,
  downloadUrl,
  downloadName,
  downloadLabel,
}: {
  src: string;
  alt: string;
  enlargeLabel: string;
  closeLabel: string;
  triggerClassName?: string;
  imgClassName?: string;
  downloadUrl?: string;
  downloadName?: string;
  downloadLabel?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={enlargeLabel}
          className={cn(
            "group relative block w-full cursor-zoom-in overflow-hidden rounded-xl bg-surface-container",
            triggerClassName,
          )}
        >
          <img
            src={src}
            alt={alt}
            className={cn(
              "mx-auto max-h-[480px] w-auto object-contain",
              imgClassName,
            )}
          />
          <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-label-sm text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
            <Icon path={ICON_PATHS.expand} className="h-4 w-4" />
            {enlargeLabel}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="w-auto max-w-[95vw] rounded-none bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <img
          src={src}
          alt={alt}
          className="mx-auto max-h-[90vh] w-auto rounded-2xl object-contain"
        />
        {downloadUrl && (
          <a
            href={downloadUrl}
            download={downloadName}
            aria-label={downloadLabel}
            className="absolute right-16 top-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-surface text-primary shadow-lg transition-colors hover:bg-surface-container-high"
          >
            <Icon path={ICON_PATHS.download} className="h-5 w-5" />
          </a>
        )}
        <DialogClose
          aria-label={closeLabel}
          className="absolute right-3 top-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-surface text-primary shadow-lg transition-colors hover:bg-surface-container-high"
        >
          <Icon path={ICON_PATHS.close} className="h-5 w-5" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
