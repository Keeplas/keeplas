import { describe, expect, it } from "vitest";
import { deviceLabelFromUserAgent, mobilePlatform } from "../user-agent";
import { storeUrlForUserAgent } from "../app-stores";

const UA = {
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
  firefoxLinux:
    "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
};

describe("deviceLabelFromUserAgent", () => {
  it.each([
    [UA.chromeMac, "Chrome on macOS"],
    [UA.safariMac, "Safari on macOS"],
    [UA.edgeWindows, "Edge on Windows"],
    [UA.firefoxLinux, "Firefox on Linux"],
    [UA.safariIphone, "Safari on iOS"],
    [UA.chromeIphone, "Chrome on iOS"],
    [UA.chromeAndroid, "Chrome on Android"],
  ])("labels %s", (ua, label) => {
    expect(deviceLabelFromUserAgent(ua)).toBe(label);
  });

  it("falls back when nothing is recognised", () => {
    expect(deviceLabelFromUserAgent("curl/8.0")).toBe("Web browser");
  });
});

describe("mobilePlatform", () => {
  it("detects phones and leaves computers out", () => {
    expect(mobilePlatform(UA.safariIphone)).toBe("ios");
    expect(mobilePlatform(UA.chromeAndroid)).toBe("android");
    expect(mobilePlatform(UA.chromeMac)).toBeNull();
  });
});

describe("storeUrlForUserAgent", () => {
  const stores = {
    appStore: "https://apps.apple.com/app/keeplas",
    playStore: "https://play.google.com/store/apps/details?id=com.keeplas.app",
  };

  it("sends each phone to its store", () => {
    expect(storeUrlForUserAgent(UA.safariIphone, stores)).toBe(stores.appStore);
    expect(storeUrlForUserAgent(UA.chromeAndroid, stores)).toBe(
      stores.playStore,
    );
  });

  it("returns null on a computer or when the store is not configured", () => {
    expect(storeUrlForUserAgent(UA.chromeMac, stores)).toBeNull();
    expect(storeUrlForUserAgent(UA.safariIphone, {})).toBeNull();
  });
});
