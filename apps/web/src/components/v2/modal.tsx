import type { ReactNode } from "react";
import {
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Icon,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

/**
 * Figma web modal (W06-3, W06-4, W06-6, W06-7): radius 20, 32 px padding,
 * serif title, muted description, close button, sections 20 px apart, over
 * the flat scrim, centered on the main column (beside the 248 px sidebar).
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  width,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** Tailwind width class from the frame, e.g. "w-[600px]". */
  width: string;
  children: ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-scrim backdrop-blur-none"
        className={cn(
          "flex max-h-[calc(100%-32px)] max-w-[calc(100%-32px)] flex-col gap-[20px] overflow-y-auto rounded-[20px] border border-border-default bg-bg-surface p-[32px] shadow-card",
          "md:left-[calc(50%+124px)]",
          width,
        )}
      >
        <div className="flex gap-[16px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
            <DialogTitle className="text-h2 text-text-primary">
              {title}
            </DialogTitle>
            {description ? (
              <DialogDescription className="text-[14px] leading-[20px] text-text-muted">
                {description}
              </DialogDescription>
            ) : null}
          </div>
          <DialogClose
            aria-label={t("close")}
            className="-m-[4px] size-[30px] shrink-0 rounded-xs p-[4px] text-text-muted hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <Icon path={ICON_PATHS.close} className="size-[22px]" />
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
