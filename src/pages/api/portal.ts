import type { APIRoute } from "astro";
import { getConvexServerClient } from "../../lib/convex";
import { corsHeaders, preflight } from "../../lib/cors";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

async function handlePortal(ctx: Parameters<APIRoute>[0]): Promise<Response> {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const siteUrl = import.meta.env.SITE_URL?.trim() as string;
  const { client } = getConvexServerClient(ctx.request);
  const viewer = await client.query(api.users.getViewer).catch(() => null);
  if (!viewer) return new Response("Unauthorized", { status: 401, headers: { ...corsHeaders(ctx.request) } });

  try {
    const result = await client.action(api.stripe.createPortal);
    return new Response(null, { status: 302, headers: { Location: (result as any).url ?? siteUrl, ...corsHeaders(ctx.request) } as Record<string, string> });
  } catch (e: any) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=${encodeURIComponent(e?.message ?? "portal_failed")}`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
}

export const GET: APIRoute = handlePortal;
export const POST: APIRoute = handlePortal;

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};
