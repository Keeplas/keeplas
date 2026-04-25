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

export default crons;
