import { mutation } from "./_generated/server";
import { v } from "convex/values";

/** Bulk-insert makes. Skips any makeId that already exists. */
export const importMakes = mutation({
  args: {
    makes: v.array(v.object({ makeId: v.string(), name: v.string() })),
  },
  handler: async (ctx, { makes }) => {
    let inserted = 0;
    for (const make of makes) {
      const existing = await ctx.db
        .query("makes")
        .withIndex("by_makeId", (q) => q.eq("makeId", make.makeId))
        .first();
      if (!existing) {
        await ctx.db.insert("makes", make);
        inserted++;
      }
    }
    return { inserted, skipped: makes.length - inserted };
  },
});

/** Bulk-insert models. Skips any modelId that already exists. */
export const importModels = mutation({
  args: {
    models: v.array(
      v.object({ modelId: v.string(), makeId: v.string(), name: v.string() }),
    ),
  },
  handler: async (ctx, { models }) => {
    let inserted = 0;
    for (const model of models) {
      const existing = await ctx.db
        .query("models")
        .withIndex("by_modelId", (q) => q.eq("modelId", model.modelId))
        .first();
      if (!existing) {
        await ctx.db.insert("models", model);
        inserted++;
      }
    }
    return { inserted, skipped: models.length - inserted };
  },
});

/** Set or update a single appConfig key. */
export const setConfig = mutation({
  args: { key: v.string(), value: v.number() },
  handler: async (ctx, { key, value }) => {
    const existing = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("appConfig", { key, value });
    }
  },
});
