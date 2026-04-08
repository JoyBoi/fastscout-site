import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
<<<<<<< HEAD

export default defineSchema({
  appConfig: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  makes: defineTable({
    externalId: v.string(),
    name: v.string(),
  }).index("by_externalId", ["externalId"]),

  models: defineTable({
    externalId: v.string(),
    makeId: v.id("makes"),
    name: v.string(),
  }).index("by_externalId", ["externalId"]).index("by_makeId", ["makeId"]),
=======
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  billingCustomers: defineTable({
    userId: v.id("users"),
    stripeCustomerId: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"]),

  subscriptions: defineTable({
    userId: v.id("users"),
    stripeSubscriptionId: v.string(),
    status: v.string(),
    priceId: v.optional(v.string()),
    periodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"]),

  subscriptionQueue: defineTable({
    userId: v.id("users"),
    currentSubscriptionId: v.string(),
    queuedSubscriptionId: v.string(),
    startAt: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("activated"),
      v.literal("canceled"),
      v.literal("failed"),
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_queuedSubscriptionId", ["queuedSubscriptionId"]),

  subscriptionAuditLog: defineTable({
    userId: v.id("users"),
    eventType: v.string(),
    details: v.any(),
  }).index("by_userId", ["userId"]),
>>>>>>> 764ee47 (feat: migrate auth and payments from Supabase to Convex + Stripe)

  missingEntries: defineTable({
    fingerprint: v.string(),
    type: v.union(v.literal("brand"), v.literal("model")),
    makeId: v.optional(v.string()),
    makeName: v.optional(v.string()),
    modelName: v.optional(v.string()),
    platform: v.optional(v.string()),
    pageUrl: v.optional(v.string()),
    lastSeenAt: v.number(),
  }).index("by_fingerprint", ["fingerprint"]),

<<<<<<< HEAD
  rateLimitEvents: defineTable({
    userId: v.string(),
    action: v.string(),
    ts: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_action", ["userId", "action"])
    .index("by_ts", ["ts"]),

  subscriptionStatus: defineTable({
    userId: v.string(),
    active: v.boolean(),
    priceId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.string()),
    planLimit: v.optional(v.number()),
    meteredItemId: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  usageCounters: defineTable({
    userId: v.string(),
    periodStart: v.number(),
    vehicleCount: v.number(),
  }).index("by_userId_period", ["userId", "periodStart"]),

  billingCustomers: defineTable({
    userId: v.string(),
    stripeCustomerId: v.string(),
  }).index("by_userId", ["userId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"]),

  reports: defineTable({
    userId: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.string(),
    source: v.optional(v.string()),
    metadata: v.optional(v.any()),
  }).index("by_userId", ["userId"]),

  users: defineTable({
    email: v.string(),
    emailLower: v.optional(v.string()),
    passwordHash: v.string(),
    name: v.optional(v.string()),
    fullName: v.optional(v.string()),
    role: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  activityEvents: defineTable({
    userId: v.string(),
    type: v.union(
      v.literal("extraction"),
      v.literal("search"),
      v.literal("manual_listing"),
      v.literal("bid"),
      v.literal("error")
    ),
    platform: v.union(
      v.literal("fastback"),
      v.literal("auto1"),
      v.literal("carcollect"),
      v.literal("autoscout24"),
      v.literal("unknown")
    ),
    ts: v.number(),
    car: v.optional(v.object({
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
    })),
    sourceUrl: v.optional(v.string()),
    as24Url: v.optional(v.string()),
    result: v.optional(v.object({
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
    })),
    fieldResults: v.optional(v.array(v.object({
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
    }))),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_type_ts", ["userId", "type", "ts"])
    .index("by_userId_ts", ["userId", "ts"])
    .index("by_ts", ["ts"])
    .index("by_type_ts", ["type", "ts"]),
=======
  makes: defineTable({
    makeId: v.string(),
    name: v.string(),
  })
    .index("by_makeId", ["makeId"])
    .index("by_name", ["name"]),

  models: defineTable({
    modelId: v.string(),
    makeId: v.string(),
    name: v.string(),
  })
    .index("by_makeId", ["makeId"])
    .index("by_modelId", ["modelId"]),

  appConfig: defineTable({
    key: v.string(),
    value: v.number(),
  }).index("by_key", ["key"]),

  reports: defineTable({
    userId: v.optional(v.id("users")),
    title: v.optional(v.string()),
    description: v.string(),
    type: v.union(
      v.literal("bug"),
      v.literal("feature_request"),
      v.literal("other"),
    ),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("closed"),
    ),
    source: v.string(),
    metadata: v.any(),
  }).index("by_userId", ["userId"]),
>>>>>>> 764ee47 (feat: migrate auth and payments from Supabase to Convex + Stripe)
});
