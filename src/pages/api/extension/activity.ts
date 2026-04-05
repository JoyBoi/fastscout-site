import type { APIRoute } from "astro";
import { corsHeaders, preflight } from "../../../lib/cors";
import { getAuthenticatedUser } from "../../../lib/auth";
import { getConvexClient } from "../../../lib/convex";
import { api } from "../../../../convex/_generated/api";

export const prerender = false;

const VALID_TYPES = ["extraction", "search", "manual_listing", "bid", "error"] as const;
const VALID_PLATFORMS = ["fastback", "auto1", "carcollect", "autoscout24", "unknown"] as const;

function isValidType(v: unknown): v is (typeof VALID_TYPES)[number] {
  return typeof v === "string" && (VALID_TYPES as readonly string[]).includes(v);
}

function isValidPlatform(v: unknown): v is (typeof VALID_PLATFORMS)[number] {
  return typeof v === "string" && (VALID_PLATFORMS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// POST /api/extension/activity — receive a single activity event
// ---------------------------------------------------------------------------
export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const headers = { "content-type": "application/json", ...corsHeaders(ctx.request) };

  const sessionUser = getAuthenticatedUser(ctx.request);
  if (!sessionUser) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  }
  const userId = sessionUser.userId;

  const convex = getConvexClient();

  // Rate limit
  let allowed: boolean;
  try {
    allowed = await convex.mutation(api.rateLimit.checkRateLimit, {
      userId,
      action: "activity_event",
    });
  } catch {
    allowed = false;
  }
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers });
  }

  // Parse body
  let payload: Record<string, unknown>;
  try {
    payload = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers });
  }

  // Validate required fields
  if (!isValidType(payload.type)) {
    return new Response(JSON.stringify({ error: "invalid_type" }), { status: 400, headers });
  }
  if (!isValidPlatform(payload.platform)) {
    return new Response(JSON.stringify({ error: "invalid_platform" }), { status: 400, headers });
  }
  if (typeof payload.ts !== "number") {
    return new Response(JSON.stringify({ error: "missing_ts" }), { status: 400, headers });
  }

  // Validate nested car object if present
  const car = payload.car as Record<string, unknown> | undefined;
  if (car && (typeof car !== "object" || typeof car.brand !== "string" || typeof car.model !== "string")) {
    return new Response(JSON.stringify({ error: "invalid_car_data" }), { status: 400, headers });
  }

  try {
    await convex.mutation(api.activityEvents.insert, {
      userId,
      type: payload.type,
      platform: payload.platform,
      ts: payload.ts,
      car: car as any,
      sourceUrl: typeof payload.sourceUrl === "string" ? payload.sourceUrl : undefined,
      as24Url: typeof payload.as24Url === "string" ? payload.as24Url : undefined,
      result: payload.result as any,
      fieldResults: payload.fieldResults as any,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "insert_failed", detail: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers },
    );
  }

  // Report billable events to Stripe Billing Meter (fire-and-forget, lazy-load stripe)
  if (payload.type === "extraction" || payload.type === "manual_listing") {
    try {
      const billing = await convex.query(api.billingCustomers.getByUserId, { userId });
      if (billing?.stripeCustomerId) {
        const { default: stripeClient } = await import("../../../lib/stripe");
        await stripeClient.billing.meterEvents.create({
          event_name: "vehicle_listing",
          payload: {
            value: "1",
            stripe_customer_id: billing.stripeCustomerId,
          },
        });
      }
    } catch (err) {
      console.error("Failed to report meter event:", err);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};
