import { errorText } from "@/lib/errors";

/**
 * The i18n key explaining why the server refused to invite, edit or re-invite
 * a contact (packages/convex/trusted_contacts.ts), else `fallback` (offline,
 * unexpected errors).
 */
export function inviteErrorKey(error: unknown, fallback: string): string {
  const text = errorText(error);
  if (text.includes("yourself")) return "people.selfInvite";
  if (text.includes("Too many invitations")) return "people.tooManyInvites";
  if (text.includes("already")) return "people.alreadyInvited";
  return fallback;
}
