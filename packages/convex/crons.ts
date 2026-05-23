import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Hourly scan of vault_items whose trigger is "time_based" and whose
 * releaseDate has passed. Each match fires the per-user release fan-out
 * (release.fanOutRelease) so recipients get an access_request entry.
 */
crons.interval(
  "release_time_based_items",
  { hours: 1 },
  internal.release.processScheduledReleases,
);

/**
 * Per-minute evaluator for the inactivity-driven Life Check trigger. For each
 * active config, initiates a new cycle when the user has been inactive for
 * longer than the configured threshold. Skips travel mode and configs that
 * already have a running/escalating cycle. Runs every minute so sub-day
 * cadences (e.g. the 60-second "test" cadence) fire promptly instead of only
 * on an hourly tick; day-scale cadences are unaffected.
 */
crons.interval(
  "life_check_evaluator",
  { minutes: 1 },
  internal.life_check.evaluateAllConfigs,
);

/**
 * Weekly availability re-confirmation sweep. Nudges trust contacts whose
 * shard verification is stale/missing and alerts the owner to replace a
 * contact who never accepted or stays unresponsive.
 */
crons.interval(
  "trusted_contact_reconfirm",
  { hours: 24 * 7 },
  internal.trusted_contacts.runAvailabilityReconfirm,
);

export default crons;
