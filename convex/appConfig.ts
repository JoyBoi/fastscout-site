import { query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    return await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
  },
});
