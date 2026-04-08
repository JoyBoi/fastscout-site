import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { rateLimiter } from "./_ratelimiter";

export const log = mutation({
  args: {
    fingerprint: v.string(),
    type: v.union(v.literal("brand"), v.literal("model")),
    makeId: v.optional(v.string()),
    makeName: v.optional(v.string()),
    modelName: v.optional(v.string()),
    platform: v.optional(v.string()),
    pageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthorized");

    await rateLimiter.limit(ctx, "log_missing", { key: userId, throws: true });

    const existing = await ctx.db
      .query("missingEntries")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", args.fingerprint))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: Date.now() });
    } else {
      await ctx.db.insert("missingEntries", { ...args, lastSeenAt: Date.now() });
    }
  },
});
