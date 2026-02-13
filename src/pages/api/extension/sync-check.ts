import type { APIRoute } from "astro";
import { corsHeaders, preflight } from "../../../lib/cors";

export const GET: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const raw = (import.meta.env.EXTENSION_DATA_VERSION as string | undefined) ?? "1";
  const version = Number.parseInt(raw, 10) || 1;
  const body = JSON.stringify({ version, force_reset: false });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "Cache-Control": "public, max-age=60",
      ...corsHeaders(ctx.request),
    },
  });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};
