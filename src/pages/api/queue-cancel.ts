import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";
import { corsHeaders, preflight } from "../../lib/cors";

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const supabase = getSupabaseServerClient(ctx as any);
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return new Response("Unauthorized", { status: 401 });
  const { data: allowed, error: rlError } = await supabase.rpc("check_rate_limit", {
    action: "cancel_queued",
    max_count: 5,
    window_seconds: 300,
  });
  const siteUrl = import.meta.env.SITE_URL as string;
  if (rlError) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=rate_limit_error`, ...corsHeaders(ctx.request) } as Record<string, string> });
  if (!allowed) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=rate_limited`, ...corsHeaders(ctx.request) } as Record<string, string> });
  const base = import.meta.env.STRIPE_WRAPPER_BASE_URL as string;
  if (!base || !/^https?:\/\/.*/.test(base)) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=misconfigured_edge_function`, ...corsHeaders(ctx.request) } as Record<string, string> });
  const res = await fetch(`${base}/cancel-queued`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return new Response("Failed to cancel queued", { status: res.status, headers: { ...corsHeaders(ctx.request) } });
  return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard`, ...corsHeaders(ctx.request) } as Record<string, string> });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};
