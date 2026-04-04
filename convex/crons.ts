import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up expired rate limit events every hour
crons.interval("cleanup rate limit events", { hours: 1 }, internal.rateLimit.cleanupOldEvents);

// Clean up activity events older than 12 months (daily)
crons.interval("cleanup old activity events", { hours: 24 }, internal.activityEvents.cleanupOldEvents);

export default crons;
