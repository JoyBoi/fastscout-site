import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Rate limit policies (hardcoded — never trust caller-supplied values)
// ---------------------------------------------------------------------------
const RATE_LIMITS: Record<string, { maxCount: number; windowMs: number }> = {
  token:          { maxCount: 10, windowMs: 300_000 },
  checkout:       { maxCount: 3,  windowMs: 60_000 },
  change_plan:    { maxCount: 5,  windowMs: 300_000 },
  cancel:         { maxCount: 5,  windowMs: 300_000 },
  reactivate:     { maxCount: 5,  windowMs: 300_000 },
  cancel_queued:  { maxCount: 5,  windowMs: 300_000 },
  portal:         { maxCount: 5,  windowMs: 60_000 },
  log_missing:    { maxCount: 20, windowMs: 60_000 },
  extension_verify: { maxCount: 30, windowMs: 60_000 },
};

const DEFAULT_LIMIT = { maxCount: 10, windowMs: 60_000 };

// ---------------------------------------------------------------------------
// Check rate limit (called from API endpoints)
// ---------------------------------------------------------------------------
export const checkRateLimit = mutation({
  args: {
    userId: v.string(),
    action: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const policy = RATE_LIMITS[args.action] ?? DEFAULT_LIMIT;

    // Query only recent events (take more than needed to avoid full scan)
    const events = await ctx.db
      .query("rateLimitEvents")
      .withIndex("by_userId_action", (q) =>
        q.eq("userId", args.userId).eq("action", args.action)
      )
      .order("desc")
      .take(policy.maxCount + 1);

    // Count events within the window
    const windowStart = now - policy.windowMs;
    const recentCount = events.filter((e) => e.ts >= windowStart).length;

    if (recentCount >= policy.maxCount) {
      return false;
    }

    // Insert new event
    await ctx.db.insert("rateLimitEvents", {
      userId: args.userId,
      action: args.action,
      ts: now,
    });

    return true;
  },
});

// ---------------------------------------------------------------------------
// Cleanup old events (call via Convex cron or manually)
// ---------------------------------------------------------------------------
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const cleanupOldEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ONE_DAY_MS;
    const stale = await ctx.db
      .query("rateLimitEvents")
      .withIndex("by_ts", (q) => q.lt("ts", cutoff))
      .take(500);

    for (const event of stale) {
      await ctx.db.delete(event._id);
    }

    return { deleted: stale.length };
  },
});
