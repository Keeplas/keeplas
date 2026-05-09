import { query } from "./_generated/server";
import { optionalAuth, getUserVault, getActiveItems } from "./helpers";

/**
 * Get all hub data in one query: continuity score, category counts,
 * recent items, contact count, feature status.
 */
export const getHubData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (userId === null) return null;

    const vault = await getUserVault(ctx, userId);
    const items = await getActiveItems(ctx, userId);

    // Category counts
    const categoryCounts: Record<string, number> = {};
    const categoriesPopulated = new Set<string>();
    for (const item of items) {
      categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
      categoriesPopulated.add(item.category);
    }

    // Recent items (last 6) — kept in sync with the Priority Actions count so
    // the Hub bottom row stays visually balanced.
    const recentItems = [...items]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6);

    // Confirmed contacts
    const contacts = await ctx.db
      .query("trusted_contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("invitationStatus"), "accepted"))
      .collect();

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

    // Continuity score: 6 axes equipondérés, identiques aux conditions des Priority Actions.
    // Garantit l'invariant: priorityActions.length === 0 ⇔ continuityScore === 100.
    const axes = [
      items.length > 0,
      contacts.length > 0,
      !!lifeCheckConfig,
      hasStrongAuth,
      phoneVerified,
      categoriesPopulated.size >= 5 && items.length > 0,
    ];
    const continuityScore = Math.round(
      (axes.filter(Boolean).length / axes.length) * 100
    );

    // Priority actions: always emit all six with their done flag, so the UI
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
        key: "life_check",
        label: "Configure Life Check",
        href: "/life-check",
        done: !!lifeCheckConfig,
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
      {
        key: "more_categories",
        label: "Add items in more categories",
        href: "/vault",
        done: categoriesPopulated.size >= 5 && items.length > 0,
      },
    ].sort((a, b) => Number(a.done) - Number(b.done));

    return {
      continuityScore,
      totalItems: items.length,
      categoryCounts,
      categoriesPopulated: categoriesPopulated.size,
      confirmedContacts: contacts.length,
      lifeCheckConfigured: !!lifeCheckConfig?.isActive,
      recentItems: recentItems.map((item) => ({
        _id: item._id,
        title: item.title,
        category: item.category,
        updatedAt: item.updatedAt,
      })),
      priorityActions,
      hasVault: !!vault,
    };
  },
});
