import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";
import { corsHeaders, preflight } from "../../lib/cors";

export const GET: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const supabase = getSupabaseServerClient(ctx as any);
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  const base = import.meta.env.STRIPE_WRAPPER_BASE_URL as string;
  if (!base || !/^https?:\/\/.*/.test(base)) return new Response(JSON.stringify({ error: "misconfigured_edge_function" }), { status: 500, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  const res = await fetch(`${base}/invoices`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await res.text();
  return new Response(body, { status: res.status, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};
