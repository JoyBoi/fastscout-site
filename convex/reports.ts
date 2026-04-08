import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
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
    });
  },
});
