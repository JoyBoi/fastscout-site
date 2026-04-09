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
  if (!viewer) return new Response("Unauthorized", { status: 401 });

  try {
    await client.action(api.stripe.cancelQueued);
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard`, ...corsHeaders(ctx.request) } as Record<string, string> });
  } catch (e: any) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=${encodeURIComponent(e?.message ?? "cancel_queued_failed")}`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};
