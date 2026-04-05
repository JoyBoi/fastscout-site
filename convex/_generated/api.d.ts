/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activityEvents from "../activityEvents.js";
import type * as appConfig from "../appConfig.js";
import type * as billingCustomers from "../billingCustomers.js";
import type * as crons from "../crons.js";
import type * as extensionData from "../extensionData.js";
import type * as makes from "../makes.js";
import type * as missingEntries from "../missingEntries.js";
import type * as models from "../models.js";
import type * as rateLimit from "../rateLimit.js";
import type * as reports from "../reports.js";
import type * as subscriptions from "../subscriptions.js";
import type * as usageCounters from "../usageCounters.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activityEvents: typeof activityEvents;
  appConfig: typeof appConfig;
  billingCustomers: typeof billingCustomers;
  crons: typeof crons;
  extensionData: typeof extensionData;
  makes: typeof makes;
  missingEntries: typeof missingEntries;
  models: typeof models;
  rateLimit: typeof rateLimit;
  reports: typeof reports;
  subscriptions: typeof subscriptions;
  usageCounters: typeof usageCounters;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
