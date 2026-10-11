import { query } from "./_generated/server";
import { optionalAuth, getUserVault, getActiveItems } from "./helpers";
import { MIN_TRUST_CONTACTS_FOR_RECOVERY } from "./trusted_contacts";

/**
 * Get all hub data in one query: continuity score, recent items, contact
 * count, feature status. Categories are encrypted (F4), so per-category
 * counts are computed on the client from the decrypted metadata.
 */
export const getHubData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

    const vault = await getUserVault(ctx, userId);
    const items = await getActiveItems(ctx, userId);

    // Recent items (last 7) — kept in sync with the Priority Actions count so
    // the Hub bottom row stays visually balanced.
    const recentItems = [...items]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 7);

    // Confirmed contacts
    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("invitationStatus"), "accepted"))
      .collect();

    // Trust contacts ready? A trust contact is ready once it has accepted and
    // published its public key. The axis is "done" only with at least
    // MIN_TRUST_CONTACTS_FOR_RECOVERY ready contacts — the unreachability
    // quorum needs two votes, so a lone guardian must not light the Hub green.
    const readyTrustContacts = contacts.filter(
      (c) =>
        (c.contactType ?? "trust") === "trust" &&
        typeof c.contactPublicKey === "string",
    );
    const contactsReady =
      readyTrustContacts.length >= MIN_TRUST_CONTACTS_FOR_RECOVERY;

    // Life Check configured?
    const lifeCheckConfig = await ctx.db
      .query("life_check_configs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Strong auth (passkey or TOTP) enrolled?
    const passkey = await ctx.db
      .query("passkey_credentials")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const totp = await ctx.db
      .query("totp_secrets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const hasStrongAuth = !!passkey || !!(totp && totp.verifiedAt);

    // WhatsApp number verified? Used by Life Check escalations and OTP-style
    // notifications, so it counts as a setup axis.
    const user = await ctx.db.get(userId);
    const phoneVerified = !!user?.phoneNumberVerifiedAt;

    // A release policy is "set" once the user has explicitly chosen the
    // confirmation fallback (saveReleasePolicy persists all three fields).
    const releasePolicySet = !!lifeCheckConfig?.fallbackBehavior;

    // At least one release introduction authored? The welcome message that
    // greets trusted contacts on the memorial vault — see
    // ReleaseIntroductionEditor on /life-check. Intros live in vault_items
    // but are excluded from the regular item listing (getActiveItems already
    // filters them out), so we look them up separately.
    const introduction = await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isReleaseIntroduction"), true),
          q.neq(q.field("status"), "archived"),
        ),
      )
      .first();
    const hasIntroduction = !!introduction;

    // Continuity score: 9 equally-weighted axes, identical to the Priority
    // Action conditions. Guarantees the invariant:
    // priorityActions.every((a) => a.done) ⇔ continuityScore === 100.
    // Note: the contacts-ready axis requires ≥ MIN_TRUST_CONTACTS_FOR_RECOVERY
    // ready guardians, so a lone contact never completes this axis.
    const axes = [
      items.length > 0,
      contacts.length > 0,
      contactsReady,
      !!lifeCheckConfig,
      releasePolicySet,
      hasStrongAuth,
      phoneVerified,
      hasIntroduction,
    ];
    const continuityScore = Math.round(
      (axes.filter(Boolean).length / axes.length) * 100,
    );

    // Priority actions: always emit all of them with their done flag, so the UI
    // can render the completed ones in a muted state ("trophée" feel).
    // Pending actions are listed first, completed ones at the bottom.
    const priorityActions: Array<{
      key: string;
      label: string;
      href: string;
      done: boolean;
    }> = [
      {
        key: "add_item",
        label: "Add your first vault item",
        href: "/vault",
        done: items.length > 0,
      },
      {
        key: "invite_contact",
        label: "Invite a trusted contact",
        href: "/trusted-contacts",
        done: contacts.length > 0,
      },
      {
        key: "contacts_ready",
        label: "Get two trusted contacts ready",
        href: "/trusted-contacts",
        done: contactsReady,
      },
      {
        key: "life_check",
        label: "Configure Life Check",
        href: "/life-check",
        done: !!lifeCheckConfig,
      },
      {
        key: "release_policy",
        label: "Set your release policy",
        href: "/life-check",
        done: releasePolicySet,
      },
      {
        key: "welcome_message",
        label: "Record a welcome message",
        href: "/life-check#welcome-message",
        done: hasIntroduction,
      },
      {
        key: "two_factor",
        label: "Activate two-factor authentication",
        href: "/settings/security",
        done: hasStrongAuth,
      },
      {
        key: "verify_whatsapp",
        label: "Verify your WhatsApp number",
        href: "/settings?verify=whatsapp",
        done: phoneVerified,
      },
    ].sort((a, b) => Number(a.done) - Number(b.done));

    return {
      continuityScore,
      totalItems: items.length,
      confirmedContacts: contacts.length,
      lifeCheckConfigured: !!lifeCheckConfig?.isActive,
      recentItems: recentItems.map((item) => ({
        _id: item._id,
        title: item.title,
        encryptedTitle: item.encryptedTitle,
        ownerWrappedDek: item.ownerWrappedDek,
        encryptionType: item.encryptionType,
        encryptedMeta: item.encryptedMeta,
        category: item.category,
        updatedAt: item.updatedAt,
      })),
      priorityActions,
      hasVault: !!vault,
    };
  },
});
