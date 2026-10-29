import { AccessibilityInfo } from "react-native";

import { TOAST_DURATION_MS, dismissToast, toast, toastStore } from "../toast";

describe("toast", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    dismissToast();
    jest.useRealTimers();
  });

  it("shows a plain message by default", () => {
    toast({ title: "Saved" });
    expect(toastStore.get()).toMatchObject({
      variant: "default",
      title: "Saved",
    });
  });

  it("replaces the current message: one toast at a time", () => {
    toast({ variant: "error", title: "Failed" });
    toast({ variant: "success", title: "Sent", description: "Body" });
    expect(toastStore.get()).toMatchObject({
      variant: "success",
      title: "Sent",
      description: "Body",
    });
  });

  it("hides itself after the duration", () => {
    toast({ title: "Saved" });
    jest.advanceTimersByTime(TOAST_DURATION_MS - 1);
    expect(toastStore.get()).not.toBeNull();
    jest.advanceTimersByTime(1);
    expect(toastStore.get()).toBeNull();
  });

  it("keeps a persistent message until it is dismissed", () => {
    toast({ title: "Preparing", persistent: true });
    jest.advanceTimersByTime(TOAST_DURATION_MS * 10);
    expect(toastStore.get()?.title).toBe("Preparing");
    dismissToast();
    expect(toastStore.get()).toBeNull();
  });

  it("restarts the timer when a new message replaces the current one", () => {
    toast({ title: "First" });
    jest.advanceTimersByTime(TOAST_DURATION_MS - 1);
    toast({ title: "Second" });
    jest.advanceTimersByTime(1);
    expect(toastStore.get()?.title).toBe("Second");
  });

  it("ignores a dismiss aimed at a message already replaced", () => {
    toast({ title: "First" });
    const first = toastStore.get()!.id;
    toast({ title: "Second" });
    dismissToast(first);
    expect(toastStore.get()?.title).toBe("Second");
  });

  it("notifies subscribers", () => {
    const listener = jest.fn();
    const unsubscribe = toastStore.subscribe(listener);
    toast({ title: "Saved" });
    dismissToast();
    unsubscribe();
    toast({ title: "Again" });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  // A copy of the toaster also renders inside each open sheet (an RN Modal
  // covers the root one), so the store announces, not each toaster.
  it("announces each new message once for screen readers", () => {
    const announce = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined);
    announce.mockClear();
    toast({ variant: "error", title: "Failed", description: "Try again" });
    toast({ title: "Saved" });
    dismissToast();
    expect(announce.mock.calls).toEqual([["Failed. Try again"], ["Saved"]]);
  });
});
