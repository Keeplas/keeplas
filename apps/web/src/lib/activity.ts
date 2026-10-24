/**
 * Audit-log actions as the W04-6 "Recent activity" list shows them: a dot
 * tone, and whether the entry is worth showing at all (background
 * migrations and key plumbing are not activity the owner did).
 */

export type ActivityTone = "active" | "pending" | "danger";

/** Actions with a translated label (`devices.activity.actions.<key>`). */
export const LABELLED_ACTIONS = [
  "device.registered",
  "device.confirmed",
  "device.revoked",
  "device.not_me",
  "pairing.session.approved",
  "passkey_registered",
  "passkey_removed",
  "vault_item.created",
  "vault_item.updated",
  "vault_item.deleted",
  "folder.access_granted",
  "folder.access_revoked",
  "trusted_contact.invited",
  "trusted_contact.updated",
  "trusted_contact.accepted",
  "trusted_contact.revoked",
  "recovery.request.started",
  "recovery.request.cancelled",
  "recovery.request.released",
  "life_check_user_confirmed",
  "cloud_backup.enabled",
  "cloud_backup.disabled",
] as const;

const HIDDEN =
  /backfill|upload_url|push_token|public_key|seeded|identity_pinned|identity_repinned|availability_confirmed|setup\.stored|preferences|legal_info|life_check_(cycle|awaiting|aborted)|pairing\.session\.(consumed|rejected)/;

const DANGER =
  /revoked|not_me|cancelled|rejected|deleted|removed|disabled|released/;
const PENDING = /started|invited|updated|postponed|travel/;

export const isShownActivity = (action: string) => !HIDDEN.test(action);

export function activityTone(action: string): ActivityTone {
  if (DANGER.test(action)) return "danger";
  if (PENDING.test(action)) return "pending";
  return "active";
}

/** i18n key of a labelled action ("device.not_me" → "device_not_me"). */
export const activityKey = (action: string) => action.replace(/\./g, "_");

/** Fallback label for actions without a translation: "Life check configured". */
export function humanizeAction(action: string): string {
  const words = action.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
