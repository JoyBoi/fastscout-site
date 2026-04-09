import type { APIRoute } from "astro";
import { getConvexServerClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const siteUrl = import.meta.env.SITE_URL?.trim() as string;
  const { client } = getConvexServerClient(ctx.request);
  const viewer = await client.query(api.users.getViewer).catch(() => null);
  if (!viewer) return new Response("Unauthorized", { status: 401 });

  try {
    await client.action(api.stripe.reactivate);
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard` } });
  } catch (e: any) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=${encodeURIComponent(e?.message ?? "reactivate_failed")}` } });
  }
};
