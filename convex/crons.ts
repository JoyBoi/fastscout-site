import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up expired rate limit events every hour
crons.interval("cleanup rate limit events", { hours: 1 }, internal.rateLimit.cleanupOldEvents);

export default crons;
