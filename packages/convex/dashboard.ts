import { query } from "./_generated/server";
import { optionalAuth, getUserVault, getActiveItems } from "./helpers";

/**
 * Get all dashboard data in one query: integrity score, category counts,
 * recent items, contact count, feature status.
 */
export const getDashboardData = query({
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

    // Recent items (last 3)
    const recentItems = [...items]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 3);

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

    // Calculate integrity score
    const categoryScore = Math.min(categoriesPopulated.size / 5, 1) * 50;
    const contactScore = Math.min(contacts.length / 3, 1) * 30;
    const lifeCheckScore = lifeCheckConfig?.isActive ? 20 : 0;
    const integrityScore = Math.round(
      categoryScore + contactScore + lifeCheckScore
    );

    // Nudge message
    let nudgeMessage = "";
    if (integrityScore === 0) {
      nudgeMessage = "Your vault is empty. Start by adding a document.";
    } else if (integrityScore <= 25) {
      nudgeMessage = "Good start! Add health directives next.";
    } else if (integrityScore <= 55) {
      nudgeMessage = "Halfway there. Invite trusted contacts for emergency access.";
    } else if (integrityScore <= 70) {
      nudgeMessage = "Almost secure. Configure Life Check for complete protection.";
    } else if (integrityScore <= 88) {
      nudgeMessage = "Strong protection! Add digital assets for premium recovery.";
    } else {
      nudgeMessage = "Near perfect! Simulate an emergency to test your workflow.";
    }

    // Priority actions
    const priorityActions: Array<{ key: string; label: string; href: string }> = [];
    if (items.length === 0) {
      priorityActions.push({ key: "add_item", label: "Add your first vault item", href: "/vault" });
    }
    if (contacts.length === 0) {
      priorityActions.push({ key: "invite_contact", label: "Invite a trusted contact", href: "/trusted-contacts" });
    }
    if (!lifeCheckConfig) {
      priorityActions.push({ key: "life_check", label: "Configure Life Check", href: "/life-check" });
    }
    if (!hasStrongAuth) {
      priorityActions.push({
        key: "two_factor",
        label: "Activate two-factor authentication",
        href: "/settings/security",
      });
    }
    if (categoriesPopulated.size < 5 && items.length > 0) {
      priorityActions.push({ key: "more_categories", label: "Add items in more categories", href: "/vault" });
    }

    return {
      integrityScore,
      nudgeMessage,
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
