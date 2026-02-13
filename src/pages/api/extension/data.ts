import type { APIRoute } from "astro";
import { corsHeaders, preflight } from "../../../lib/cors";
import { getSupabaseServerClient } from "../../../lib/supabase";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const supabase = getSupabaseServerClient(ctx as any);

  // 1. Get version from app_config
  const { data: configData } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "brand_data_version")
    .single();

  const version = configData?.value ? Number(configData.value) : 1;

  // 2. Fetch all makes
  // We select id, name. We map them to { id, n } for the extension.
  const { data: makesData, error: makesError } = await supabase
    .from("makes")
    .select("id, name")
    .order("name");

  if (makesError) {
    return new Response(JSON.stringify({ error: "fetch_failed_makes" }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
    });
  }

  // 3. Fetch all models
  // We select id, name, make_id. We map them to { id, n, m }
  const { data: modelsData, error: modelsError } = await supabase
    .from("models")
    .select("id, name, make_id")
    .order("name");

  if (modelsError) {
    return new Response(JSON.stringify({ error: "fetch_failed_models" }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
    });
  }

  // 4. Transform to minified format
  const makes = (makesData || []).map((row) => ({
    id: String(row.id),
    n: row.name,
  }));

  const models = (modelsData || []).map((row) => ({
    id: String(row.id),
    n: row.name,
    m: String(row.make_id),
  }));

  const body = JSON.stringify({ version, makes, models });

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      // Cache for 1 hour
      "Cache-Control": "public, max-age=3600",
      ...corsHeaders(ctx.request),
    },
  });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};
