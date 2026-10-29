// Links saved on a vault item (v1 items, imported archives): a JSON array of
// URLs, encrypted with the item's DEK, in the optional encryptedLinks field.
// parseLinks tolerates any malformed payload by returning an empty array.

const OPENABLE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * The URL to open for a saved link, or null when it must stay inert text.
 * Links are written by the item owner and shown to their contacts, and
 * neither React nor window.open filters `javascript:` / `data:` URLs there.
 */
export function safeLinkHref(url: string): string | null {
  const trimmed = url.trim();
  try {
    return OPENABLE_PROTOCOLS.has(new URL(trimmed).protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

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
