import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptionStatus")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    userId: v.string(),
    active: v.boolean(),
    priceId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptionStatus")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        active: args.active,
        priceId: args.priceId,
        currentPeriodEnd: args.currentPeriodEnd,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("subscriptionStatus", {
        userId: args.userId,
        active: args.active,
        priceId: args.priceId,
        currentPeriodEnd: args.currentPeriodEnd,
      });
    }
  },
});
