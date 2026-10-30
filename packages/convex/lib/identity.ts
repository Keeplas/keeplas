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

// How a vault owner is named to their trusted contacts: their name, else the
// email local part, else their phone (phone-only accounts may have no name).
export function ownerDisplay(
  owner: { name?: string; email?: string; phoneNumber?: string } | null,
) {
  const email = owner?.email ?? "";
  const phone = owner?.phoneNumber ?? null;
  const name =
    owner?.name?.trim() || email.split("@")[0] || phone || "Keeplas user";
  return { name, email, phone };
}

// The owner's identity fields for a trusted-contact alert (dispatch.ts),
// without the rest of the user row.
export function ownerIdentity(
  owner: { name?: string; email?: string; phoneNumber?: string } | null,
) {
  return {
    name: owner?.name,
    email: owner?.email,
    phoneNumber: owner?.phoneNumber,
  };
}
