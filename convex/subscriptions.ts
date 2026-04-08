import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  },
});

export const getBillingCustomer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("billingCustomers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  },
});

export const getByStripeCustomerId = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, { stripeCustomerId }) => {
    return await ctx.db
      .query("billingCustomers")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", stripeCustomerId),
      )
      .first();
  },
});

export const upsertFromWebhook = internalMutation({
  args: {
    userId: v.id("users"),
    stripeSubscriptionId: v.string(),
    status: v.string(),
    priceId: v.optional(v.string()),
    periodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        stripeSubscriptionId: args.stripeSubscriptionId,
        status: args.status,
        priceId: args.priceId,
        periodEnd: args.periodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      });
    } else {
      await ctx.db.insert("subscriptions", args);
    }
    await ctx.db.insert("subscriptionAuditLog", {
      userId: args.userId,
      eventType: "subscription_synced",
      details: {
        stripeSubscriptionId: args.stripeSubscriptionId,
        status: args.status,
        priceId: args.priceId,
      },
    });
  },
});

export const upsertBillingCustomer = internalMutation({
  args: { userId: v.id("users"), stripeCustomerId: v.string() },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    const existing = await ctx.db
      .query("billingCustomers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { stripeCustomerId });
    } else {
      await ctx.db.insert("billingCustomers", { userId, stripeCustomerId });
    }
  },
});

export const cancelQueued = mutation({
  args: { queuedSubscriptionId: v.string() },
  handler: async (ctx, { queuedSubscriptionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthorized");
    const queued = await ctx.db
      .query("subscriptionQueue")
      .withIndex("by_queuedSubscriptionId", (q) =>
        q.eq("queuedSubscriptionId", queuedSubscriptionId),
      )
      .first();
    if (!queued || queued.userId !== userId) throw new Error("not_found");
    await ctx.db.patch(queued._id, { status: "canceled" });
  },
});
