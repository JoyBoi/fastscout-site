/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _ratelimiter from "../_ratelimiter.js";
import type * as activityEvents from "../activityEvents.js";
import type * as appConfig from "../appConfig.js";
import type * as auth from "../auth.js";
import type * as billingCustomers from "../billingCustomers.js";
import type * as crons from "../crons.js";
import type * as extensionData from "../extensionData.js";
import type * as http from "../http.js";
import type * as makes from "../makes.js";
import type * as missingEntries from "../missingEntries.js";
import type * as models from "../models.js";
import type * as rateLimit from "../rateLimit.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as stripe from "../stripe.js";
import type * as subscriptions from "../subscriptions.js";
import type * as usageCounters from "../usageCounters.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  _ratelimiter: typeof _ratelimiter;
  activityEvents: typeof activityEvents;
  appConfig: typeof appConfig;
  auth: typeof auth;
  billingCustomers: typeof billingCustomers;
  crons: typeof crons;
  extensionData: typeof extensionData;
  http: typeof http;
  makes: typeof makes;
  missingEntries: typeof missingEntries;
  models: typeof models;
  rateLimit: typeof rateLimit;
  reports: typeof reports;
  seed: typeof seed;
  stripe: typeof stripe;
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

export declare const components: {
  ratelimiter: {
    public: {
      checkRateLimit: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      rateLimit: FunctionReference<
        "mutation",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      resetRateLimit: FunctionReference<
        "mutation",
        "internal",
        { key?: string; name: string },
        null
      >;
    };
  };
};
