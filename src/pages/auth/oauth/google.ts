import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../../lib/supabase";

export const GET: APIRoute = async (ctx) => {
  const supabase = getSupabaseServerClient(ctx as any);
  const siteUrl = import.meta.env.SITE_URL as string;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });
  if (error || !data.url) return new Response(null, { status: 302, headers: { Location: "/auth?error=oauth_google_failed" } });
  return new Response(null, { status: 302, headers: { Location: data.url } });
};

