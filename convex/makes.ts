import { query } from "./_generated/server";
<<<<<<< HEAD
import { v } from "convex/values";
=======
>>>>>>> 764ee47 (feat: migrate auth and payments from Supabase to Convex + Stripe)

export const list = query({
  args: {},
  handler: async (ctx) => {
<<<<<<< HEAD
    const makes = await ctx.db.query("makes").collect();
    return makes.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("makes")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
=======
    return await ctx.db.query("makes").withIndex("by_name").order("asc").collect();
>>>>>>> 764ee47 (feat: migrate auth and payments from Supabase to Convex + Stripe)
  },
});
