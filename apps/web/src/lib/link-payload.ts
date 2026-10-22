// Links saved on a vault item (v1 items, imported archives): a JSON array of
// URLs, encrypted with the item's DEK, in the optional encryptedLinks field.
// parseLinks tolerates any malformed payload by returning an empty array.

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
