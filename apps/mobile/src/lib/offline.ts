/** How long the backend may stay unreachable before the app says so. */
export const OFFLINE_AFTER_MS = 10_000;

/** The part of the Convex client that knows whether its socket is up. */
export interface ConnectionSource {
  connectionState(): { isWebSocketConnected: boolean };
  subscribeToConnectionState(cb: () => void): () => void;
}

/** A request gave up: the backend stayed unreachable for OFFLINE_AFTER_MS. */
export class OfflineError extends Error {
  constructor() {
    super("No connection");
    this.name = "OfflineError";
  }
}

/**
 * Calls `onChange(true)` once the socket has been down for `ms`, then
 * `onChange(false)` when it is back. A shorter drop goes unnoticed. Returns
 * the unsubscribe.
 */
export function watchOffline(
  source: ConnectionSource,
  onChange: (offline: boolean) => void,
  ms = OFFLINE_AFTER_MS,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let reported = false;
  const check = () => {
    if (source.connectionState().isWebSocketConnected) {
      if (timer) clearTimeout(timer);
      timer = null;
      if (reported) {
        reported = false;
        onChange(false);
      }
    } else if (!timer && !reported) {
      timer = setTimeout(() => {
        timer = null;
        reported = true;
        onChange(true);
      }, ms);
    }
  };
  const unsubscribe = source.subscribeToConnectionState(check);
  check();
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}

/**
 * Convex queues a request until its socket reconnects, so offline a sign-in
 * would spin forever. This fails it with OfflineError once the socket has
 * been down for OFFLINE_AFTER_MS; a slow but connected request is left alone.
 */
export function failWhenOffline<T>(
  work: Promise<T>,
  source: ConnectionSource,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const stop = watchOffline(source, (offline) => {
      if (offline) reject(new OfflineError());
    });
    work.then(resolve, reject).finally(stop);
  });
}
