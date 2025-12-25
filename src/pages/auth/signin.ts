import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";

export const GET: APIRoute = async (ctx) => {
  const supabase = getSupabaseServerClient(ctx as any);
  const siteUrl = import.meta.env.SITE_URL as string;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });
  if (error || !data.url) return new Response("OAuth init failed", { status: 500 });
  return new Response(null, { status: 302, headers: { Location: data.url } });
};
