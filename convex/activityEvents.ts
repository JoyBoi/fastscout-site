import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const eventType = v.union(
  v.literal("extraction"),
  v.literal("search"),
  v.literal("manual_listing"),
  v.literal("bid"),
  v.literal("error")
);

const platform = v.union(
  v.literal("fastback"),
  v.literal("auto1"),
  v.literal("carcollect"),
  v.literal("autoscout24"),
  v.literal("unknown")
);

const carValidator = v.optional(v.object({
  brand: v.string(),
  model: v.string(),
  vin: v.optional(v.string()),
  year: v.optional(v.string()),
  mileage: v.optional(v.number()),
  fuelType: v.optional(v.string()),
  transmission: v.optional(v.string()),
  power: v.optional(v.string()),
  price: v.optional(v.number()),
  color: v.optional(v.string()),
  registration: v.optional(v.string()),
}));

const resultValidator = v.optional(v.object({
  status: v.optional(v.union(
    v.literal("success"),
    v.literal("partial"),
    v.literal("failed")
  )),
  fieldsTotal: v.optional(v.number()),
  fieldsSuccess: v.optional(v.number()),
  fieldsError: v.optional(v.number()),
  fieldsSkipped: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  bidAmount: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  errorContext: v.optional(v.string()),
}));

const fieldResultValidator = v.optional(v.array(v.object({
  fieldName: v.string(),
  status: v.union(
    v.literal("success"),
    v.literal("error"),
    v.literal("skipped"),
    v.literal("manual")
  ),
  attemptedValue: v.optional(v.string()),
  selectedValue: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
})));

// ---------------------------------------------------------------------------
// Helper: increment usage counter for billable events
// ---------------------------------------------------------------------------
async function incrementUsageCounter(ctx: any, userId: string) {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const existing = await ctx.db
    .query("usageCounters")
    .withIndex("by_userId_period", (q: any) =>
      q.eq("userId", userId).eq("periodStart", periodStart)
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, { vehicleCount: existing.vehicleCount + 1 });
  } else {
    await ctx.db.insert("usageCounters", { userId, periodStart, vehicleCount: 1 });
  }
}

// ---------------------------------------------------------------------------
// Insert a single activity event
// ---------------------------------------------------------------------------
export const insert = mutation({
  args: {
    userId: v.string(),
    type: eventType,
    platform,
    ts: v.number(),
    car: carValidator,
    sourceUrl: v.optional(v.string()),
    as24Url: v.optional(v.string()),
    result: resultValidator,
    fieldResults: fieldResultValidator,
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("activityEvents", args);
    if (args.type === "extraction" || args.type === "manual_listing") {
      await incrementUsageCounter(ctx, args.userId);
    }
    return id;
  },
});

// ---------------------------------------------------------------------------
// Insert a batch of events (up to 20)
// ---------------------------------------------------------------------------
export const insertBatch = mutation({
  args: {
    events: v.array(v.object({
      userId: v.string(),
      type: eventType,
      platform,
      ts: v.number(),
      car: carValidator,
      sourceUrl: v.optional(v.string()),
      as24Url: v.optional(v.string()),
      result: resultValidator,
      fieldResults: fieldResultValidator,
    })),
  },
  handler: async (ctx, args) => {
    const batch = args.events.slice(0, 20);
    const ids = [];
    for (const event of batch) {
      ids.push(await ctx.db.insert("activityEvents", event));
      if (event.type === "extraction" || event.type === "manual_listing") {
        await incrementUsageCounter(ctx, event.userId);
      }
    }
    return { inserted: ids.length };
  },
});

// ---------------------------------------------------------------------------
// List events for a user (paginated, optional type filter)
// ---------------------------------------------------------------------------
export const listByUser = query({
  args: {
    userId: v.string(),
    type: v.optional(eventType),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()), // ts of last item for cursor-based pagination
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 100);

    if (args.type) {
      const q = ctx.db
        .query("activityEvents")
        .withIndex("by_userId_type_ts", (q) => {
          const base = q.eq("userId", args.userId).eq("type", args.type!);
          return args.cursor ? base.lt("ts", args.cursor) : base;
        })
        .order("desc");

      const events = await q.take(limit);
      const nextCursor = events.length === limit ? events[events.length - 1].ts : null;
      return { events, nextCursor };
    }

    const q = ctx.db
      .query("activityEvents")
      .withIndex("by_userId_ts", (q) => {
        const base = q.eq("userId", args.userId);
        return args.cursor ? base.lt("ts", args.cursor) : base;
      })
      .order("desc");

    const events = await q.take(limit);
    const nextCursor = events.length === limit ? events[events.length - 1].ts : null;
    return { events, nextCursor };
  },
});

// ---------------------------------------------------------------------------
// Stats for a single user over a date range
// ---------------------------------------------------------------------------
export const statsByUser = query({
  args: {
    userId: v.string(),
    from: v.optional(v.number()), // ts
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const from = args.from ?? 0;
    const to = args.to ?? Date.now();

    const events = await ctx.db
      .query("activityEvents")
      .withIndex("by_userId_ts", (q) =>
        q.eq("userId", args.userId).gte("ts", from).lte("ts", to)
      )
      .take(10000);

    const counts = { extraction: 0, search: 0, manual_listing: 0, bid: 0, error: 0 };
    let listingSuccess = 0;
    let listingPartial = 0;
    let listingFailed = 0;
    let totalDurationMs = 0;
    let durationCount = 0;

    for (const e of events) {
      counts[e.type]++;
      if (e.type === "manual_listing" && e.result?.status) {
        if (e.result.status === "success") listingSuccess++;
        else if (e.result.status === "partial") listingPartial++;
        else if (e.result.status === "failed") listingFailed++;
        if (e.result.durationMs) {
          totalDurationMs += e.result.durationMs;
          durationCount++;
        }
      }
    }

    return {
      total: events.length,
      counts,
      listing: {
        success: listingSuccess,
        partial: listingPartial,
        failed: listingFailed,
        successRate: counts.manual_listing > 0
          ? Math.round((listingSuccess / counts.manual_listing) * 100)
          : 0,
      },
      avgDurationMs: durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0,
      funnel: {
        extraction: counts.extraction,
        search: counts.search,
        listing: counts.manual_listing,
        bid: counts.bid,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Global stats across all users (admin)
// ---------------------------------------------------------------------------
// Admin-only — auth check enforced by Astro API layer
export const globalStats = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const from = args.from ?? 0;
    const to = args.to ?? Date.now();

    const events = await ctx.db
      .query("activityEvents")
      .withIndex("by_ts", (q) => q.gte("ts", from).lte("ts", to))
      .take(10000);

    const counts = { extraction: 0, search: 0, manual_listing: 0, bid: 0, error: 0 };
    const userIds = new Set<string>();

    for (const e of events) {
      counts[e.type]++;
      userIds.add(e.userId);
    }

    const days = Math.max(1, (to - from) / (24 * 60 * 60 * 1000));

    return {
      total: events.length,
      counts,
      activeUsers: userIds.size,
      eventsPerDay: Math.round(events.length / days),
    };
  },
});

// ---------------------------------------------------------------------------
// List all events (admin, paginated)
// ---------------------------------------------------------------------------
// Admin-only — auth check enforced by Astro API layer
export const listAll = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 100);

    let q = ctx.db
      .query("activityEvents")
      .withIndex("by_ts", (qb) => {
        return args.cursor ? qb.lt("ts", args.cursor) : qb;
      })
      .order("desc");

    const events = await q.take(limit);
    const nextCursor = events.length === limit ? events[events.length - 1].ts : null;
    return { events, nextCursor };
  },
});

// ---------------------------------------------------------------------------
// Export events for CSV (up to 5000)
// ---------------------------------------------------------------------------
export const exportByUser = query({
  args: {
    userId: v.optional(v.string()), // omit for admin export of all
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    type: v.optional(eventType),
  },
  handler: async (ctx, args) => {
    const from = args.from ?? 0;
    const to = args.to ?? Date.now();

    let events;
    if (args.userId) {
      events = await ctx.db
        .query("activityEvents")
        .withIndex("by_userId_ts", (q) =>
          q.eq("userId", args.userId!).gte("ts", from).lte("ts", to)
        )
        .order("desc")
        .take(5000);
    } else {
      events = await ctx.db
        .query("activityEvents")
        .withIndex("by_ts", (q) => q.gte("ts", from).lte("ts", to))
        .order("desc")
        .take(5000);
    }

    if (args.type) {
      events = events.filter((e) => e.type === args.type);
    }

    return events;
  },
});

// ---------------------------------------------------------------------------
// Cleanup old events (cron: delete events older than 12 months)
// ---------------------------------------------------------------------------
export const cleanupOldEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const stale = await ctx.db
      .query("activityEvents")
      .withIndex("by_ts", (q) => q.lt("ts", cutoff))
      .take(500);

    for (const event of stale) {
      await ctx.db.delete(event._id);
    }

    return { deleted: stale.length };
  },
});
