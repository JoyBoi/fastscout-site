import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Returns the authenticated user document, or null if not signed in. */
export const getViewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
