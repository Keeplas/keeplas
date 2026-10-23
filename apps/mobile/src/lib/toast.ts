/**
 * Transient feedback ("Sent", "Something went wrong"), rendered by the single
 * <Toaster /> mounted in the root layout. Same variants and look as the web
 * toast (@keeplas/ui). Confirmations and choices stay native `Alert`s.
 */
import { useSyncExternalStore } from "react";

export type ToastVariant = "default" | "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
}

export const TOAST_DURATION_MS = 4000;

let current: ToastMessage | null = null;
let nextId = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(message: ToastMessage | null) {
  clearTimeout(timer);
  current = message;
  if (message) {
    timer = setTimeout(() => dismissToast(message.id), TOAST_DURATION_MS);
  }
  for (const listener of listeners) listener();
}

/** Shows a message, replacing the current one: one toast at a time. */
export function toast({
  variant = "default",
  title,
  description,
}: Omit<ToastMessage, "id" | "variant"> & { variant?: ToastVariant }) {
  set({ id: ++nextId, variant, title, description });
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
