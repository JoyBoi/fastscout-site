import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function getCurrentPeriodStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

export const increment = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const periodStart = getCurrentPeriodStart();
    const existing = await ctx.db
      .query("usageCounters")
      .withIndex("by_userId_period", (q) =>
        q.eq("userId", args.userId).eq("periodStart", periodStart)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        vehicleCount: existing.vehicleCount + 1,
      });
      return existing.vehicleCount + 1;
    } else {
      await ctx.db.insert("usageCounters", {
        userId: args.userId,
        periodStart,
        vehicleCount: 1,
      });
      return 1;
    }
  },
});

export const getForCurrentPeriod = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const periodStart = getCurrentPeriodStart();
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_userId_period", (q) =>
        q.eq("userId", args.userId).eq("periodStart", periodStart)
      )
      .unique();

    return counter?.vehicleCount ?? 0;
  },
});
