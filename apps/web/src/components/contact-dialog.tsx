import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Icon,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { ContactForm } from "./contact-form";

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Wraps the concierge {@link ContactForm} in a dialog so it can be reached from
 * contexts without the settings shell — e.g. the locked-vault Unlock screen.
 */
export function ContactDialog({ open, onOpenChange }: ContactDialogProps) {
  const t = useTranslations("settings");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-5 items-start static">
          <DialogTitle>{t("sidebar.contact")}</DialogTitle>
          <DialogClose className="p-2 hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer">
            <Icon
              path={ICON_PATHS.close}
              className="w-5 h-5 text-on-surface-variant"
              strokeWidth={2}
            />
          </DialogClose>
        </DialogHeader>

        <div className="px-6 pb-6 pt-2 max-h-[70vh] overflow-y-auto">
          <ContactForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}
