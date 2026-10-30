import {
  failWhenOffline,
  OFFLINE_AFTER_MS,
  OfflineError,
  watchOffline,
  type ConnectionSource,
} from "../offline";

/** A Convex client stand-in whose socket the test opens and closes. */
function socket(connected: boolean) {
  const listeners = new Set<() => void>();
  const source: ConnectionSource = {
    connectionState: () => ({ isWebSocketConnected: connected }),
    subscribeToConnectionState(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
  const set = (next: boolean) => {
    connected = next;
    listeners.forEach((cb) => cb());
  };
  return { source, set, listeners };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("watchOffline", () => {
  it("reports offline once the socket has been down long enough, then back", () => {
    const { source, set } = socket(false);
    const onChange = jest.fn();
    watchOffline(source, onChange);
    jest.advanceTimersByTime(OFFLINE_AFTER_MS - 1);
    expect(onChange).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onChange).toHaveBeenLastCalledWith(true);
    set(true);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("ignores a short drop", () => {
    const { source, set } = socket(true);
    const onChange = jest.fn();
    watchOffline(source, onChange);
    set(false);
    jest.advanceTimersByTime(OFFLINE_AFTER_MS / 2);
    set(true);
    jest.advanceTimersByTime(OFFLINE_AFTER_MS);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stops watching when unsubscribed", () => {
    const { source, listeners } = socket(false);
    const onChange = jest.fn();
    watchOffline(source, onChange)();
    jest.advanceTimersByTime(OFFLINE_AFTER_MS);
    expect(onChange).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });
});

describe("failWhenOffline", () => {
  it("fails a request that waits for a connection that never comes", async () => {
    const { source } = socket(false);
    const pending = failWhenOffline(new Promise(() => undefined), source);
    jest.advanceTimersByTime(OFFLINE_AFTER_MS);
    await expect(pending).rejects.toBeInstanceOf(OfflineError);
  });

  it("leaves a slow request alone while connected", async () => {
    const { source } = socket(true);
    let finish: (value: string) => void = () => undefined;
    const pending = failWhenOffline(
      new Promise<string>((resolve) => (finish = resolve)),
      source,
    );
    jest.advanceTimersByTime(3 * OFFLINE_AFTER_MS);
    finish("done");
    await expect(pending).resolves.toBe("done");
  });

  it("passes the request's own error through", async () => {
    const { source, listeners } = socket(true);
    await expect(
      failWhenOffline(Promise.reject(new Error("Invalid code")), source),
    ).rejects.toThrow("Invalid code");
    expect(listeners.size).toBe(0);
  });
});
