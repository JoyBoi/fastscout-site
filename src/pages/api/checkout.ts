import type { APIRoute } from "astro";
import { getConvexServerClient } from "../../lib/convex";
import { preflight, corsHeaders } from "../../lib/cors";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const siteUrl = import.meta.env.SITE_URL?.trim() as string;
  const { client } = getConvexServerClient(ctx.request);
  const viewer = await client.query(api.users.getViewer).catch(() => null);
  if (!viewer) return new Response(null, { status: 302, headers: { Location: "/auth?mode=signup" } });

  const form = await ctx.request.formData();
  const plan = (form.get("plan") as string | null) ?? undefined;

  try {
    const result = await client.action(api.stripe.createCheckout, { plan });
    return new Response(null, { status: 302, headers: { Location: (result as any).url ?? siteUrl } });
  } catch (e: any) {
    const msg = e?.message ?? "checkout_failed";
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=${encodeURIComponent(msg)}` } });
  }
};

export const GET: APIRoute = async (ctx) => {
  const siteUrl = import.meta.env.SITE_URL?.trim() as string;
  const { token } = getConvexServerClient(ctx.request);
  if (!token) return new Response(null, { status: 302, headers: { Location: "/auth?mode=signup" } });
  return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing` } });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};
