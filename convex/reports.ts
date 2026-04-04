import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
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
    });
  },
});
