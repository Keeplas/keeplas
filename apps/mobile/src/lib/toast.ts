/**
 * Transient feedback ("Sent", "Something went wrong"), rendered by the
 * <Toaster /> of the root layout, and by a copy in each open bottom sheet
 * (an RN Modal covers the root one). Same variants and look as the web
 * toast (@keeplas/ui). Confirmations and choices stay native `Alert`s.
 */
import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

export type ToastVariant = "default" | "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
  /** Stays until dismissed (e.g. a progress message), instead of timing out. */
  persistent?: boolean;
}

export const TOAST_DURATION_MS = 4000;

let current: ToastMessage | null = null;
let nextId = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(message: ToastMessage | null) {
  clearTimeout(timer);
  current = message;
  if (message && !message.persistent) {
    timer = setTimeout(() => dismissToast(message.id), TOAST_DURATION_MS);
  }
  // Announced here, once, however many toasters show the message.
  if (message) {
    AccessibilityInfo.announceForAccessibility(
      [message.title, message.description].filter(Boolean).join(". "),
    );
  }
  for (const listener of listeners) listener();
}

/** Shows a message, replacing the current one: one toast at a time. */
export function toast({
  variant = "default",
  title,
  description,
  persistent,
}: Omit<ToastMessage, "id" | "variant"> & { variant?: ToastVariant }) {
  set({ id: ++nextId, variant, title, description, persistent });
}

/** Hides the current message, or only message `id` if it is still shown. */
export function dismissToast(id?: number) {
  if (!current || (id !== undefined && current.id !== id)) return;
  set(null);
}

export const toastStore = {
  get: () => current,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useToast(): ToastMessage | null {
  return useSyncExternalStore(toastStore.subscribe, toastStore.get);
}
