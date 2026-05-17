import { internalMutation } from "./_generated/server";

/**
 * One-shot backfill for the per-recipient release feature:
 *   - trusted_contacts.contactType → "trust"
 *   - vault_items.recipientMode    → "default"
 *   - vault_items.sharedWithGroups → []
 *   - per user, create a default recipient_group containing all current
 *     trust contacts (only if the user has no default group yet).
 *
 * Safe to re-run: every step skips rows already populated.
 */
export const migrateRecipients = internalMutation({
  args: {},
  handler: async (ctx) => {
    let contactsPatched = 0;
    let itemsPatched = 0;
    let groupsCreated = 0;

    const contacts = await ctx.db.query("trusted_contacts").collect();
    for (const c of contacts) {
      if (c.contactType === undefined) {
        await ctx.db.patch(c._id, {
          contactType: "trust",
          updatedAt: Date.now(),
        });
        contactsPatched++;
      }
    }

    const items = await ctx.db.query("vault_items").collect();
    for (const item of items) {
      const patch: Record<string, unknown> = {};
      if (item.recipientMode === undefined) patch.recipientMode = "default";
      if (item.sharedWithGroups === undefined) patch.sharedWithGroups = [];
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = Date.now();
        await ctx.db.patch(item._id, patch);
        itemsPatched++;
      }
    }

    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      const existingDefault = await ctx.db
        .query("recipient_groups")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", user._id).eq("isDefault", true),
        )
        .first();
      if (existingDefault) continue;

      const userTrustContacts = await ctx.db
        .query("trusted_contacts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.neq(q.field("invitationStatus"), "revoked"))
        .collect();

      const memberContactIds = userTrustContacts
        .filter((c) => (c.contactType ?? "trust") === "trust")
        .map((c) => c._id);

      const now = Date.now();
      await ctx.db.insert("recipient_groups", {
        userId: user._id,
        name: "All trust contacts",
        description: "Default group — every accepted trust contact.",
        memberContactIds,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
      groupsCreated++;
    }

    return { contactsPatched, itemsPatched, groupsCreated };
  },
});

/**
 * Strip the deprecated `tags` field from every vault_items row. Tags were
 * never used for filter/search and have been removed from the UI. After
 * this migration runs (and the field is observed undefined on every row),
 * the `tags` field can be removed from the schema entirely.
 */
export const dropVaultItemTags = internalMutation({
  args: {},
  handler: async (ctx) => {
    let cleared = 0;
    const items = await ctx.db.query("vault_items").collect();
    for (const item of items) {
      if (item.tags !== undefined) {
        await ctx.db.patch(item._id, {
          tags: undefined,
          updatedAt: Date.now(),
        });
        cleared++;
      }
    }
    return { cleared };
  },
});

/**
 * Convert any legacy vault_items with category="personal_message" to
 * "conditional_message" — the two were redundant and have been collapsed
 * into a single "Letter / Personal Message" category. Idempotent.
 */
export const collapsePersonalMessageCategory = internalMutation({
  args: {},
  handler: async (ctx) => {
    let patched = 0;
    const items = await ctx.db.query("vault_items").collect();
    for (const item of items) {
      // @ts-expect-error legacy category, removed from the validator
      if (item.category === "personal_message") {
        await ctx.db.patch(item._id, {
          category: "conditional_message",
          updatedAt: Date.now(),
        });
        patched++;
      }
    }
    return { patched };
  },
});

/**
 * Merge legacy conditional_messages rows into their backing vault_items.
 *
 * Each conditional_messages row already shadows a vault_items row via
 * vaultItemId. We patch the vault_items row with the trigger config +
 * status from the conditional_messages row, then delete the legacy row.
 *
 * Idempotent: if a conditional_messages row's vault_items target is gone
 * (broken backref), the legacy row is dropped without an error. Already
 * migrated conditional_messages rows are removed; rows whose target
 * already has triggerType set are still cleaned up safely.
 *
 * After running this, the conditional_messages table can be removed from
 * schema.ts in a follow-up deploy.
 */
export const mergeConditionalMessagesIntoVault = internalMutation({
  args: {},
  handler: async (ctx) => {
    let merged = 0;
    let orphaned = 0;

    const legacy = await ctx.db.query("conditional_messages").collect();

    for (const msg of legacy) {
      const item = await ctx.db.get(msg.vaultItemId);
      if (!item) {
        // Backing vault item is gone — just drop the legacy row.
        await ctx.db.delete(msg._id);
        orphaned++;
        continue;
      }

      // Drop legacy triggers that no longer exist in our union.
      const supportedTriggers = new Set([
        "life_check_failure",
        "time_based",
        "manual",
      ]);
      const triggerType = supportedTriggers.has(msg.triggerType)
        ? (msg.triggerType as "life_check_failure" | "time_based" | "manual")
        : "manual";

      const triggerConfig = msg.triggerConfig?.releaseDate
        ? { releaseDate: msg.triggerConfig.releaseDate }
        : undefined;

      // Map legacy status to the vault_items status union.
      const statusMap: Record<
        string,
        "active" | "draft" | "archived" | "sealed" | "released"
      > = {
        draft: "draft",
        active: "active",
        sealed: "sealed",
        released: "released",
        cancelled: "archived",
      };
      const status = statusMap[msg.status] ?? "active";

      await ctx.db.patch(msg.vaultItemId, {
        triggerType,
        triggerConfig,
        releasedAt: msg.releasedAt,
        status,
        updatedAt: Date.now(),
      });

      await ctx.db.delete(msg._id);
      merged++;
    }

    return { merged, orphaned };
  },
});

/**
 * Rewrite legacy `scenario_steps.actions` entries to the new 3-action set.
 *
 * Mapping:
 *   - `send_message` → `grant_access` (closest functional equivalent: the
 *     scenario engine fans out vault items to recipients; per-message
 *     timed triggers continue to live on `vault_items.triggerType`).
 *   - `unlock_vault` → dropped (vault unlock is now implicit when the
 *     scenario dispatches; no per-step toggle needed).
 *
 * After this migration runs and observation confirms no rows still hold
 * `send_message` / `unlock_vault`, the legacy literals can be removed from
 * the `scenario_steps.actions[].actionType` validator in `schema.ts`.
 *
 * Idempotent: rows whose actions already use only the new set are skipped.
 */
export const migrateScenarioActions = internalMutation({
  args: {},
  handler: async (ctx) => {
    let stepsPatched = 0;
    let stepsCleared = 0;

    const steps = await ctx.db.query("scenario_steps").collect();
    for (const step of steps) {
      let touched = false;
      const next: typeof step.actions = [];
      for (const action of step.actions) {
        // The literals are no longer in the typed union after the schema
        // narrow. Compare via a string cast so this migration remains
        // re-runnable against environments still holding legacy rows.
        const actionType = action.actionType as string;
        if (actionType === "send_message") {
          next.push({ ...action, actionType: "grant_access" });
          touched = true;
        } else if (actionType === "unlock_vault") {
          touched = true;
        } else {
          next.push(action);
        }
      }
      if (touched) {
        await ctx.db.patch(step._id, { actions: next });
        if (next.length === 0) stepsCleared++;
        else stepsPatched++;
      }
    }

    return { stepsPatched, stepsCleared };
  },
});

/**
 * Scrub the deprecated plaintext `description` field from every vault_items
 * row. Earlier the Add-to-Vault dialog mistakenly sent the rich-text body in
 * plaintext as `description` while ALSO encrypting it into `encryptedContent`
 * — breaking the zero-knowledge guarantee. The dialog and edit form no
 * longer write to `description`; this migration clears any leaked plaintext
 * left in storage. After it runs and the field stays undefined on every row,
 * `description` can be removed from the schema entirely.
 */
export const dropVaultItemDescriptions = internalMutation({
  args: {},
  handler: async (ctx) => {
    let cleared = 0;
    const items = await ctx.db.query("vault_items").collect();
    for (const item of items) {
      if (item.description !== undefined) {
        await ctx.db.patch(item._id, {
          description: undefined,
          updatedAt: Date.now(),
        });
        cleared++;
      }
    }
    return { cleared };
  },
});

/**
 * Backfill the WhatsApp verification channel into every existing
 * life_check_configs row. WhatsApp is now the primary channel — new users
 * already get it via DEFAULT_CHANNELS, but rows saved before WhatsApp was
 * introduced (or saved while it was the disabled 4th option) need the row
 * inserted at order 1, with the previous channels' order shifted by +1
 * to preserve their relative ordering.
 *
 * Idempotent: rows already containing a "whatsapp" entry are skipped.
 */
export const addWhatsAppChannelToLifeCheckConfigs = internalMutation({
  args: {},
  handler: async (ctx) => {
    let patched = 0;
    let skipped = 0;

    const configs = await ctx.db.query("life_check_configs").collect();
    for (const config of configs) {
      if (config.activeChannels.some((ch) => ch.type === "whatsapp")) {
        skipped++;
        continue;
      }

      const shifted = config.activeChannels.map((ch) => ({
        ...ch,
        order: ch.order + 1,
      }));
      const next = [
        {
          type: "whatsapp" as const,
          order: 1,
          isEnabled: true,
          delayHours: 36,
        },
        ...shifted,
      ];

      await ctx.db.patch(config._id, {
        activeChannels: next,
        updatedAt: Date.now(),
      });
      patched++;
    }

    return { patched, skipped };
  },
});
