import { mutation } from "./_generated/server";
<<<<<<< HEAD
import { v } from "convex/values";

export const upsert = mutation({
=======
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { rateLimiter } from "./_ratelimiter";

export const log = mutation({
>>>>>>> 764ee47 (feat: migrate auth and payments from Supabase to Convex + Stripe)
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
<<<<<<< HEAD
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
=======
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
>>>>>>> 764ee47 (feat: migrate auth and payments from Supabase to Convex + Stripe)
    }
  },
});
