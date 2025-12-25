import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up stale in-progress sessions every hour
// Sessions that have been in_progress for more than 2 hours are considered abandoned
crons.hourly(
  "cleanup stale sessions",
  { minuteUTC: 0 }, // Run at the top of every hour
  internal.sessions.cleanupOrphanedSessions,
  { maxAgeMs: 2 * 60 * 60 * 1000 } // 2 hours threshold
);

export default crons;
