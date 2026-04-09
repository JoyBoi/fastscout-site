import type { APIRoute } from "astro";
import { getConvexServerClient } from "../../lib/convex";
import { corsHeaders, preflight } from "../../lib/cors";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const siteUrl = import.meta.env.SITE_URL?.trim() as string;
  const { client } = getConvexServerClient(ctx.request);
  const viewer = await client.query(api.users.getViewer).catch(() => null);
  if (!viewer) return new Response("Unauthorized", { status: 401, headers: { ...corsHeaders(ctx.request) } });

  let targetPriceId: string | undefined;
  let plan: string | undefined;
  try {
    const form = await ctx.request.formData();
    const p = form.get("price_id");
    const pl = form.get("plan");
    if (typeof p === "string" && p) targetPriceId = p;
    if (typeof pl === "string" && pl) plan = pl;
  } catch {}

  if (!targetPriceId && plan) {
    const map: Record<string, string | undefined> = {
      monthly: import.meta.env.STRIPE_PRICE_ID_MONTHLY,
      annual: import.meta.env.STRIPE_PRICE_ID_YEARLY,
      quarterly: import.meta.env.STRIPE_PRICE_ID_QUARTERLY,
      halfyearly: import.meta.env.STRIPE_PRICE_ID_HALFYEARLY,
    };
    targetPriceId = map[plan];
  }
  if (!targetPriceId) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=missing_price_id`, ...corsHeaders(ctx.request) } as Record<string, string> });

  try {
    await client.action(api.stripe.changePlan, { targetPriceId });
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?success=plan_change_scheduled`, ...corsHeaders(ctx.request) } as Record<string, string> });
  } catch (e: any) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=${encodeURIComponent(e?.message ?? "change_plan_failed")}`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};
