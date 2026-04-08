import { query } from "./_generated/server";
<<<<<<< HEAD
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
=======
>>>>>>> 764ee47 (feat: migrate auth and payments from Supabase to Convex + Stripe)

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("models").collect();
  },
});
<<<<<<< HEAD

export const listByMake = query({
  args: { makeId: v.id("makes") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("models")
      .withIndex("by_makeId", (q) => q.eq("makeId", args.makeId))
      .collect();
  },
});

export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("models")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
  },
});
=======
>>>>>>> 764ee47 (feat: migrate auth and payments from Supabase to Convex + Stripe)
