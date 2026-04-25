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
  internal.release.processScheduledReleases
);

/**
 * Hourly evaluator for the inactivity-driven Life Check trigger. For each
 * active config, initiates a new cycle when the user has been inactive for
 * longer than the configured threshold. Skips travel mode and configs that
 * already have a running/escalating cycle.
 */
crons.interval(
  "life_check_evaluator",
  { hours: 1 },
  internal.life_check.evaluateAllConfigs
);

export default crons;
