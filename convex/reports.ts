import { mutation } from "./_generated/server";
<<<<<<< HEAD
=======
import { getAuthUserId } from "@convex-dev/auth/server";
>>>>>>> 764ee47 (feat: migrate auth and payments from Supabase to Convex + Stripe)
import { v } from "convex/values";

export const create = mutation({
  args: {
<<<<<<< HEAD
    userId: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.string(),
    source: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("reports", {
      userId: args.userId,
      title: args.title,
      description: args.description,
      type: args.type,
      source: args.source,
      metadata: args.metadata,
=======
    title: v.optional(v.string()),
    description: v.string(),
    type: v.union(v.literal("bug"), v.literal("feature_request"), v.literal("other")),
    source: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await ctx.db.insert("reports", {
      ...args,
      userId: userId ?? undefined,
      status: "open",
>>>>>>> 764ee47 (feat: migrate auth and payments from Supabase to Convex + Stripe)
    });
  },
});
