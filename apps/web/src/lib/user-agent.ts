// User-agent parsing for labels and store routing. Best effort only: the
// result is shown to the user (device list, new-device alert), never trusted.

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Version\/.*Safari\//, "Safari"],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Macintosh|Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];

function match(table: Array<[RegExp, string]>, ua: string): string | null {
  return table.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
}

/** "Chrome on macOS", for `devices.register` and the passkey name. */
export function deviceLabelFromUserAgent(ua: string): string {
  const browser = match(BROWSERS, ua);
  const system = match(SYSTEMS, ua);
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? "Web browser";
}

/** Mobile platform with an app store, or null on a computer. */
export function mobilePlatform(ua: string): "ios" | "android" | null {
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}
