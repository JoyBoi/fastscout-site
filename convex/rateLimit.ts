import { mutation } from "./_generated/server";
import { v } from "convex/values";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const checkRateLimit = mutation({
  args: {
    userId: v.string(),
    action: v.string(),
    maxCount: v.number(),
    windowSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowMs = args.windowSeconds * 1000;
    const cutoff = now - ONE_DAY_MS;

    // Get all events for this user+action
    const events = await ctx.db
      .query("rateLimitEvents")
      .withIndex("by_userId_action", (q) =>
        q.eq("userId", args.userId).eq("action", args.action)
      )
      .collect();

    // Delete events older than 1 day
    for (const event of events) {
      if (event.ts < cutoff) {
        await ctx.db.delete(event._id);
      }
    }

    // Count events within the window
    const windowStart = now - windowMs;
    const recentCount = events.filter(
      (e) => e.ts >= windowStart && e.ts >= cutoff
    ).length;

    // Check if allowed
    if (recentCount >= args.maxCount) {
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
