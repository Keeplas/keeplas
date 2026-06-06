// Format a person's display identity for outgoing messages:
// "Name (email · phone)" — both identifiers when available, else whichever
// exists, else the fallback. Used so recipients (e.g. a trusted contact) can
// identify an ambiguous name (homonym, first-name-only, nickname).
export function formatSenderIdentity(
  p: {
    name?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
  } | null,
  fallback = "A Keeplas user",
): string {
  const name = p?.name?.trim();
  const ids = [p?.email?.trim(), p?.phoneNumber?.trim()].filter(Boolean);
  const suffix = ids.length ? ` (${ids.join(" · ")})` : "";
  if (name) return `${name}${suffix}`;
  return ids.length ? ids.join(" · ") : fallback;
}
