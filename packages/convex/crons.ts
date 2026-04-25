import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Hourly scan of conditional_messages with triggerType="time_based" and a
 * releaseDate that has passed. Each match fires the per-user release fan-out
 * (release.triggerRelease) so recipients get an access_request entry.
 */
crons.interval(
  "release_time_based_messages",
  { hours: 1 },
  internal.conditional_messages.processScheduledReleases
);

export default crons;
