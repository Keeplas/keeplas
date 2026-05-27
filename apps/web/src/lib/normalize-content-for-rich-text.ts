/**
 * Wrap plain text in a paragraph so newlines survive the rich-text round-trip.
 * Legacy items were stored as plain text; new items are TipTap HTML. If the
 * content already starts with an HTML tag, pass it through untouched.
 */
export function normalizeContentForRichText(content: string): string {
  if (/^\s*<[a-z!/]/i.test(content)) return content;
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<p>${escaped}</p>`;
}
