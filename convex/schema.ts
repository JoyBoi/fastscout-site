import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
  }).index("by_userId", ["userId"]),

  billingCustomers: defineTable({
    userId: v.string(),
    stripeCustomerId: v.string(),
  }).index("by_userId", ["userId"]),

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
});
