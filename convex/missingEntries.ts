import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
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
    const existing = await ctx.db
      .query("missingEntries")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", args.fingerprint))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
      return existing._id;
    } else {
      return await ctx.db.insert("missingEntries", {
        ...args,
        lastSeenAt: now,
      });
    }
  },
});
