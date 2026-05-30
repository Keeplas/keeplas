import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useIdleTimer,
  AUTO_LOCK_TIMEOUT_MS,
  IDLE_ACTIVITY_EVENTS,
} from "../use-idle-timer";

describe("useIdleTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onIdle after the timeout elapses with no activity", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ onIdle, enabled: true }));

    expect(onIdle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(AUTO_LOCK_TIMEOUT_MS);
    });

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("does not call onIdle before the timeout elapses", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ onIdle, enabled: true }));

    act(() => {
      vi.advanceTimersByTime(AUTO_LOCK_TIMEOUT_MS - 1);
    });

    expect(onIdle).not.toHaveBeenCalled();
  });

  it("resets the timer on user activity so onIdle does not fire", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ onIdle, enabled: true }));

    // Almost time out, then a user activity event resets the clock.
    act(() => {
      vi.advanceTimersByTime(AUTO_LOCK_TIMEOUT_MS - 100);
      window.dispatchEvent(new Event(IDLE_ACTIVITY_EVENTS[0]));
    });

    // Past the ORIGINAL deadline — must not fire because activity reset it.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onIdle).not.toHaveBeenCalled();

    // A full timeout after the activity does fire.
    act(() => {
      vi.advanceTimersByTime(AUTO_LOCK_TIMEOUT_MS);
    });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("throttles activity so a burst of events does not reset on every event", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ onIdle, enabled: true }));

    // Two events within the throttle window: the second is ignored, so the
    // deadline is anchored to the first event only.
    act(() => {
      window.dispatchEvent(new Event(IDLE_ACTIVITY_EVENTS[0]));
      vi.advanceTimersByTime(50);
      window.dispatchEvent(new Event(IDLE_ACTIVITY_EVENTS[0]));
    });

    // The second (throttled) event must NOT have pushed the deadline out.
    act(() => {
      vi.advanceTimersByTime(AUTO_LOCK_TIMEOUT_MS - 50);
    });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled (vault already locked)", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ onIdle, enabled: false }));

    act(() => {
      vi.advanceTimersByTime(AUTO_LOCK_TIMEOUT_MS * 2);
    });

    expect(onIdle).not.toHaveBeenCalled();
  });

  it("uses a 20-minute default timeout", () => {
    expect(AUTO_LOCK_TIMEOUT_MS).toBe(20 * 60 * 1000);
  });
});
