<<<<<<< HEAD
import { query, mutation } from "./_generated/server";
=======
import { query } from "./_generated/server";
>>>>>>> 764ee47 (feat: migrate auth and payments from Supabase to Convex + Stripe)
import { v } from "convex/values";

export const get = query({
  args: { key: v.string() },
<<<<<<< HEAD
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return config?.value ?? null;
  },
});

export const set = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("appConfig", { key: args.key, value: args.value });
    }
=======
  handler: async (ctx, { key }) => {
    return await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
>>>>>>> 764ee47 (feat: migrate auth and payments from Supabase to Convex + Stripe)
  },
});
