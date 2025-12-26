import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";
import { corsHeaders, preflight } from "../../lib/cors";

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const supabase = getSupabaseServerClient(ctx as any);
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return new Response("Unauthorized", { status: 401, headers: { ...corsHeaders(ctx.request) } });
  const { data: allowed, error: rlError } = await supabase.rpc("check_rate_limit", {
    action: "change_plan",
    max_count: 5,
    window_seconds: 300,
  });
  const siteUrl = import.meta.env.SITE_URL as string;
  const proceed = rlError ? true : !!allowed;
  if (!proceed) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=rate_limited`, ...corsHeaders(ctx.request) } as Record<string, string> });
  let body: Record<string, string> = {};
  try {
    const form = await (ctx.request as Request).formData();
    const plan = form.get("plan");
    const priceId = form.get("price_id");
    if (typeof plan === "string") body.plan = plan;
    if (typeof priceId === "string") body.price_id = priceId;
  } catch {}
  const base = import.meta.env.STRIPE_WRAPPER_BASE_URL as string;
  if (!base || !/^https?:\/\/.*/.test(base)) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=misconfigured_edge_function`, ...corsHeaders(ctx.request) } as Record<string, string> });
  const res = await fetch(`${base}/change-plan`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (txt.includes("missing_price_id")) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=missing_price_id`, ...corsHeaders(ctx.request) } as Record<string, string> });
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=change_plan_failed`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?success=plan_change_scheduled`, ...corsHeaders(ctx.request) } as Record<string, string> });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};
