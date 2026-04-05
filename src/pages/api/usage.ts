import type { APIRoute } from "astro";
import { getAuthenticatedUser } from "../../lib/auth";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { corsHeaders, preflight } from "../../lib/cors";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const sessionUser = getAuthenticatedUser(ctx.request);
  if (!sessionUser) return new Response("Unauthorized", { status: 401, headers: { ...corsHeaders(ctx.request) } });
  const userId = sessionUser.userId;

  const convex = getConvexClient();
  const [usage, sub] = await Promise.all([
    convex.query(api.usageCounters.getForCurrentPeriod, { userId }),
    convex.query(api.subscriptions.getByUserId, { userId }),
  ]);

  const planLimit = sub?.planLimit ?? 500;
  const vehicleCount = usage ?? 0;
  const extraCount = Math.max(0, vehicleCount - planLimit);
  const extraCostPerVehicle = planLimit <= 500 ? 0.15 : 0.08;

  return new Response(JSON.stringify({
    vehicleCount,
    planLimit,
    extraCount,
    extraCostPerVehicle,
    estimatedExtra: Math.round(extraCount * extraCostPerVehicle * 100) / 100,
  }), {
    status: 200,
    headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
  });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};
