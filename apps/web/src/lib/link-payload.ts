// Helpers for the always-on "Linked URLs" section on every vault item. The
// list of URLs is encoded as a JSON array, encrypted with the item's DEK,
// and stored in the optional encryptedLinks field. parseLinks tolerates any
// malformed payload by returning an empty array — never throws.

export function serializeLinks(urls: string[]): string {
  return JSON.stringify(urls);
}

export function parseLinks(plaintext: string): string[] {
  try {
    const parsed = JSON.parse(plaintext) as unknown;
    if (Array.isArray(parsed) && parsed.every((u) => typeof u === "string")) {
      return parsed as string[];
    }
    return [];
  } catch {
    return [];
  }
}

export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
