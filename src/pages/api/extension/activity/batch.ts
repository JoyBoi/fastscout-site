import type { APIRoute } from "astro";
import { corsHeaders, preflight } from "../../../../lib/cors";
import jwt from "jsonwebtoken";
import { getConvexClient } from "../../../../lib/convex";
import { api } from "../../../../../convex/_generated/api";

export const prerender = false;

const VALID_TYPES = ["extraction", "search", "manual_listing", "bid", "error"] as const;
const VALID_PLATFORMS = ["fastback", "auto1", "carcollect", "autoscout24", "unknown"] as const;

// ---------------------------------------------------------------------------
// POST /api/extension/activity/batch — receive up to 20 events (queue flush)
// ---------------------------------------------------------------------------
export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const headers = { "content-type": "application/json", ...corsHeaders(ctx.request) };

  const authHeader = ctx.request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  }
  let tokenPayload: { email?: string };
  try {
    tokenPayload = jwt.verify(bearerToken, import.meta.env.JWT_SECRET!) as { email?: string };
  } catch {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  }
  const userId = tokenPayload.email ?? "unknown";

  // Rate limit (one check per batch call)
  const convex = getConvexClient();
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

  let payload: { events?: unknown[] };
  try {
    payload = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers });
  }

  if (!Array.isArray(payload.events) || payload.events.length === 0) {
    return new Response(JSON.stringify({ error: "empty_events" }), { status: 400, headers });
  }

  // Validate and sanitize each event
  const validEvents = [];
  for (const raw of payload.events.slice(0, 20)) {
    const e = raw as Record<string, unknown>;
    if (
      typeof e.type === "string" && (VALID_TYPES as readonly string[]).includes(e.type) &&
      typeof e.platform === "string" && (VALID_PLATFORMS as readonly string[]).includes(e.platform) &&
      typeof e.ts === "number"
    ) {
      validEvents.push({
        userId,
        type: e.type as any,
        platform: e.platform as any,
        ts: e.ts,
        car: e.car as any,
        sourceUrl: typeof e.sourceUrl === "string" ? e.sourceUrl : undefined,
        as24Url: typeof e.as24Url === "string" ? e.as24Url : undefined,
        result: e.result as any,
        fieldResults: e.fieldResults as any,
      });
    }
  }

  if (validEvents.length === 0) {
    return new Response(JSON.stringify({ error: "no_valid_events" }), { status: 400, headers });
  }

  try {
    const result = await convex.mutation(api.activityEvents.insertBatch, { events: validEvents });

    return new Response(JSON.stringify({ ok: true, inserted: result.inserted }), { status: 200, headers });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "insert_failed", detail: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers },
    );
  }
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};
