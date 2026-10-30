import { v } from "convex/values";
import { internalMutation, query, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  approvedReleaseRequest,
  requireAuth,
  requireFullAuth,
  resolveItemRecipients,
} from "./helpers";
import { createAuditLog } from "./audit";
import { activePushTokens } from "./devices";
import { createNotification } from "./helpers";
import { formatSenderIdentity } from "./lib/identity";
import { batchArgs, batchPage, scheduleNextBatch } from "./lib/batch";

/** Due time-based items read per cron run. */
const RELEASE_BATCH_SIZE = 50;

/** Every vault item a release hands out: neither archived nor private. */
async function releasableItems(ctx: MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("vault_items")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) =>
      q.and(
        q.neq(q.field("status"), "archived"),
        q.neq(q.field("accessLevel"), "private"),
      ),
    )
    .collect();
}

/**
 * Run the per-recipient release fan-out of `items` for a user. For each item,
 * resolve the effective recipient set, then give each recipient ONE approved
 * access_requests row whose sectionsRequested lists the item IDs that
 * recipient may see (memorial serves that row). Recipients pull matching
 * wrapped DEKs from vault_item_recipient_keys and decrypt client-side.
 *
 * Idempotent per item: a recipient who already holds a release row (an
 * earlier time-based item, or a release the owner never revoked) gets only
 * the items it doesn't list yet, appended to that row.
 */
async function fanOutRelease(
  ctx: MutationCtx,
  userId: Id<"users">,
  items: Doc<"vault_items">[],
  reason: string,
): Promise<{
  recipientsReached: number;
  itemsDistributed: number;
  requestsCreated: number;
}> {
  const perRecipient = new Map<Id<"trusted_contacts">, Id<"vault_items">[]>();

  for (const item of items) {
    const recipients = await resolveItemRecipients(ctx, item, userId);
    for (const cid of recipients) {
      const list = perRecipient.get(cid) ?? [];
      list.push(item._id);
      perRecipient.set(cid, list);
    }
  }

  const now = Date.now();
  let requestsCreated = 0;

  const owner = await ctx.db.get(userId);
  const ownerName = formatSenderIdentity(owner);

  for (const [contactId, itemIds] of perRecipient.entries()) {
    // Only a prior PER-RECIPIENT release (a row carrying `item:` sections)
    // counts. The recovery-quorum request uses the `["all"]` sentinel and gets
    // flipped to "approved" by releaseAfterConfirmation for the contacts who
    // confirmed unreachability — it must NOT shadow the release fan-out, or
    // those contacts would never receive their item list.
    const existing = await approvedReleaseRequest(ctx, contactId);
    const sections = itemIds.map((id) => `item:${id}`);
    const added = existing
      ? sections.filter((s) => !existing.sectionsRequested.includes(s))
      : sections;
    if (added.length === 0) continue;

    if (existing) {
      await ctx.db.patch(existing._id, {
        sectionsRequested: [...existing.sectionsRequested, ...added],
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("access_requests", {
        vaultUserId: userId,
        requestedBy: contactId,
        sectionsRequested: added,
        status: "approved",
        respondedAt: now,
        autoResponseAt: now,
        createdAt: now,
        updatedAt: now,
        reason,
      });
      requestsCreated++;
    }

    const contact = await ctx.db.get(contactId);
    if (contact?.contactUserId) {
      await createNotification(ctx, {
        userId: contact.contactUserId,
        type: "access_request",
        title: "Vault released to you",
        body: `You've been granted read access to ${added.length} item${added.length === 1 ? "" : "s"} from a vault you are a recipient of.`,
        actionUrl: "/shared-with-me",
        channels: ["push", "email"],
        relatedType: "access_request",
      });

      // Real outbound delivery (push + email + WhatsApp): the actionable trigger to
      // come back and perform recovery, days after they confirmed.
      const contactUser = await ctx.db.get(contact.contactUserId);
      await ctx.scheduler.runAfter(0, internal.dispatch.notifyRelease, {
        email: contact.email,
        phoneNumber: contact.phoneNumber,
        contactName: contact.name,
        ownerName,
        language: contactUser?.language,
        pushTokens: await activePushTokens(ctx, contact.contactUserId),
      });
    }
  }

  await createAuditLog(ctx, {
    userId,
    actorType: "system",
    actorId: "release",
    action: "vault_released",
    resourceType: "user",
    resourceId: userId,
    metadata: JSON.stringify({
      reason,
      recipients: perRecipient.size,
      items: items.length,
      requestsCreated,
    }),
  });

  return {
    recipientsReached: perRecipient.size,
    itemsDistributed: items.length,
    requestsCreated,
  };
}

/**
 * Internal trigger callable from scenario execution / life_check escalation.
 */
export const triggerRelease = internalMutation({
  args: { userId: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    const items = await releasableItems(ctx, args.userId);
    return await fanOutRelease(ctx, args.userId, items, args.reason);
  },
});

/**
 * Test-only: fires a real release on the given vault owner to verify the
 * fan-out. Internal-only so it never reaches the public `api.*` surface — a
 * public release trigger would let any authenticated caller bypass Life
 * Check / quorum / grace. Callable from testing/QA code via `internal.*`.
 */
export const simulateEmergencyTrigger = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Internal-only (never on the public api surface), so it is not the
    // direct-call attack surface the step-up gate defends — left on
    // requireAuth. requireFullAuth would over-gate this QA helper.
    const userId = await requireAuth(ctx);
    const items = await releasableItems(ctx, userId);
    return await fanOutRelease(ctx, userId, items, "manual_simulation");
  },
});

/**
 * Owner-facing preview: for each trusted contact, the items they'd receive (and
 * at what access level) if a release fired right now. Mirrors fanOutRelease's
 * resolution exactly, so the owner can verify "who gets what" before anything
 * is triggered. Read-only; touches no release state.
 */
export const getReleasePreview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireFullAuth(ctx);

    const items = await ctx.db
      .query("vault_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "archived"),
          q.neq(q.field("accessLevel"), "private"),
        ),
      )
      .collect();

    // Titles are encrypted; carry the ciphertext + the owner's wrapped DEK so
    // the owner's client can decrypt them in the preview (legacy `title` kept
    // as a fallback for rows not yet migrated).
    type PreviewTitle = {
      _id: Id<"vault_items">;
      title?: string;
      encryptedTitle?: string;
      ownerWrappedDek?: string;
    };
    const perContact = new Map<Id<"trusted_contacts">, PreviewTitle[]>();
    for (const item of items) {
      const recipients = await resolveItemRecipients(ctx, item, userId);
      for (const cid of recipients) {
        const titles = perContact.get(cid) ?? [];
        titles.push({
          _id: item._id,
          title: item.title,
          encryptedTitle: item.encryptedTitle,
          ownerWrappedDek: item.ownerWrappedDek,
        });
        perContact.set(cid, titles);
      }
    }

    const result = [];
    for (const [contactId, titles] of perContact.entries()) {
      const contact = await ctx.db.get(contactId);
      if (!contact) continue;
      result.push({
        contactId,
        name: contact.name,
        role: contact.role,
        itemCount: titles.length,
        itemTitles: titles.slice(0, 5),
      });
    }
    return result;
  },
});

/**
 * Cron entry point: release every active vault item with a time_based
 * trigger whose releaseDate has passed — THAT item, to its own recipients
 * (a dated letter), never the rest of the owner's vault. A private item has
 * no recipients, so nothing is released.
 *
 * The index range stops at now, so future-dated letters (and undated ones,
 * which are never released) are never read. One page per run, then the next
 * is scheduled (lib/batch.ts); each item is released in its own
 * subtransaction, so one item that fails can't hold back the others.
 */
export const processScheduledReleases = internalMutation({
  args: batchArgs,
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("vault_items")
      .withIndex("by_trigger_release_date", (q) =>
        q
          .eq("triggerType", "time_based")
          .eq("status", "active")
          .gt("triggerConfig.releaseDate", 0)
          .lte("triggerConfig.releaseDate", Date.now()),
      )
      .paginate(batchPage(RELEASE_BATCH_SIZE, args.cursor));

    let released = 0;
    for (const item of page.page) {
      try {
        const done: boolean = await ctx.runMutation(
          internal.release.releaseScheduledItem,
          { itemId: item._id },
        );
        if (done) released++;
      } catch (error) {
        console.error(`Scheduled release failed for item ${item._id}`, error);
      }
    }

    await scheduleNextBatch(
      ctx,
      page,
      internal.release.processScheduledReleases,
    );
    return { scanned: page.page.length, released };
  },
});

/**
 * Release one due time-based item. Idempotent — re-checks that the item is
 * still active and due, then flips it to "released", so a re-run or an
 * overlapping tick never releases it twice. Returns whether it released.
 */
export const releaseScheduledItem = internalMutation({
  args: { itemId: v.id("vault_items") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const item = await ctx.db.get(args.itemId);
    const releaseAt = item?.triggerConfig?.releaseDate;
    if (
      !item ||
      item.triggerType !== "time_based" ||
      item.status !== "active" ||
      !releaseAt ||
      releaseAt > now
    ) {
      return false;
    }

    if (item.accessLevel !== "private") {
      await fanOutRelease(ctx, item.userId, [item], `time_based:${item._id}`);
    }

    await ctx.db.patch(item._id, {
      status: "released",
      releasedAt: now,
      updatedAt: now,
    });
    return true;
  },
});
