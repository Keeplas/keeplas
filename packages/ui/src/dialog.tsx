"use client";

import * as React from "react";
import * as DialogPrimitives from "@radix-ui/react-dialog";
import { cn } from "./lib/utils";

const DialogLayerContext = React.createContext<HTMLElement | null>(null);

const Dialog = DialogPrimitives.Root;

const DialogTrigger = DialogPrimitives.Trigger;

const DialogPortal = DialogPrimitives.Portal;

const DialogClose = DialogPrimitives.Close;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitives.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-primary/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitives.Overlay.displayName;

// Prevent Radix Dialog's dismissal / focus-trap from interfering with popups
// portaled by Base UI (Select, DatePicker, Tooltip) while they're open inside
// the Dialog. Without this, clicking a Base UI popup is treated as "outside"
// the Dialog and the popup is closed (or never paints) before the user can
// interact with it.
function isInsideBaseUiPortal(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest(
      "[data-base-ui-portal], [data-base-ui-popup], [data-popup], [data-floating-ui-portal]"
    ) !== null
  );
}

export function useDialogLayerContainer() {
  return React.useContext(DialogLayerContext);
}

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Content>
>(
  (
    {
      className,
      children,
      onPointerDownOutside,
      onInteractOutside,
      onFocusOutside,
      ...props
    },
    ref
  ) => {
    const [layerContainer, setLayerContainer] =
      React.useState<HTMLDivElement | null>(null);

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogLayerContext.Provider value={layerContainer}>
          <div
            ref={setLayerContainer}
            data-keeplas-dialog-layer=""
            aria-hidden="true"
            className="fixed inset-0 z-[60] pointer-events-none"
          />
          <DialogPrimitives.Content
            ref={ref}
            data-keeplas-dialog-content=""
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              className
            )}
            onPointerDownOutside={(event) => {
              onPointerDownOutside?.(event);
              if (!event.defaultPrevented && isInsideBaseUiPortal(event.target)) {
                event.preventDefault();
              }
            }}
            onInteractOutside={(event) => {
              onInteractOutside?.(event);
              if (!event.defaultPrevented && isInsideBaseUiPortal(event.target)) {
                event.preventDefault();
              }
            }}
            onFocusOutside={(event) => {
              onFocusOutside?.(event);
              if (!event.defaultPrevented && isInsideBaseUiPortal(event.target)) {
                event.preventDefault();
              }
            }}
            {...props}
          >
            {children}
          </DialogPrimitives.Content>
        </DialogLayerContext.Provider>
      </DialogPortal>
    );
  }
);
DialogContent.displayName = DialogPrimitives.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "sticky top-0 bg-surface p-6 pb-4 border-b border-outline-variant/10 flex items-center justify-between",
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitives.Title
    ref={ref}
    className={cn(
      "font-headline text-xl font-extrabold text-primary tracking-tight",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitives.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitives.Description
    ref={ref}
    className={cn("text-sm text-on-surface-variant", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitives.Description.displayName;

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
};
