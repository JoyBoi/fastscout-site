import { query } from "./_generated/server";

export const getData = query({
  args: {},
  handler: async (ctx) => {
    const versionConfig = await ctx.db
      .query("appConfig")
      .withIndex("by_key", (q) => q.eq("key", "brand_data_version"))
      .unique();

    const makes = await ctx.db.query("makes").collect();
    const models = await ctx.db.query("models").collect();

    return {
      version: versionConfig?.value ?? null,
      makes: makes.sort((a, b) => a.name.localeCompare(b.name)),
      models,
    };
  },
});
