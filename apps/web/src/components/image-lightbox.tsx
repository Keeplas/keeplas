import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
  DialogTitle,
  Icon,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

/**
 * Click-to-enlarge wrapper for a decrypted image attachment. The thumbnail is
 * the dialog trigger; opening it shows the full-resolution image in a
 * near-fullscreen overlay. Used by both the owner (vault) and contact
 * (memorial) attachment cards, so the markup lives here once.
 */
export function ImageLightbox({
  src,
  alt,
  enlargeLabel,
  closeLabel,
}: {
  src: string;
  alt: string;
  enlargeLabel: string;
  closeLabel: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={enlargeLabel}
          className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl bg-surface-container"
        >
          <img
            src={src}
            alt={alt}
            className="mx-auto max-h-[480px] w-auto object-contain"
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
