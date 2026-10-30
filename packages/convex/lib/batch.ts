import { v } from "convex/values";
import type { FunctionReference, PaginationResult } from "convex/server";
import type { MutationCtx } from "../_generated/server";

/**
 * Self-rescheduling batch jobs for the cron sweeps that walk a whole table.
 * One transaction over every row would fail past the Convex limits (16 MiB /
 * 32k documents read, 1000 scheduled functions per mutation), roll back, and
 * fail the same way on every later tick, for every user. Instead each run
 * reads one page and schedules the next.
 */

/**
 * Bytes one page may read. Rows can carry inline ciphertext (up to the 1 MiB
 * document limit), so a page also stops here, well under the 16 MiB budget
 * the run's own work shares.
 */
const BATCH_MAX_BYTES_READ = 4 * 1024 * 1024;

/** Args of a batch job: the page to read, absent on the cron's first run. */
export const batchArgs = { cursor: v.optional(v.string()) };

/** Pagination options for one page, capped in rows and in bytes read. */
export function batchPage(numItems: number, cursor: string | undefined) {
  return {
    numItems,
    cursor: cursor ?? null,
    maximumBytesRead: BATCH_MAX_BYTES_READ,
  };
}

/** Schedule the job again on the next page, unless this page was the last. */
export async function scheduleNextBatch(
  ctx: MutationCtx,
  page: PaginationResult<unknown>,
  job: FunctionReference<"mutation", "internal", { cursor?: string }>,
) {
  if (page.isDone) return;
  await ctx.scheduler.runAfter(0, job, { cursor: page.continueCursor });
}
