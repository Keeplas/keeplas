"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastVariant,
} from "./toast";
import { useToast } from "./use-toast";
import { Icon } from "./icon";
import { cn } from "./lib/utils";

// Kit icons (PRD/v2-mobile-first/design-kit/svg/icons) tinted with status
// tokens. `default` is a plain message, without icon.
const VARIANT_ICONS: Partial<
  Record<ToastVariant, { path: string; className: string }>
> = {
  success: {
    path: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12l2.5 2.5 4.5-5",
    className: "text-status-active",
  },
  error: {
    path: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V13M12 16.5h.01",
    className: "text-action-danger",
  },
  info: {
    path: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.5h.01",
    className: "text-text-accent",
  },
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, title, description, action, variant, ...props }) => {
        const icon = variant ? VARIANT_ICONS[variant] : undefined;
        return (
          <Toast key={id} {...props}>
            {icon && (
              <Icon
                path={icon.path}
                className={cn("size-[22px] shrink-0", icon.className)}
                aria-hidden
              />
            )}
            <div className="grid min-w-0 flex-1 gap-[2px]">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
