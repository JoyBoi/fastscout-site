import type { APIRoute } from "astro";
import { corsHeaders, preflight } from "../../../lib/cors";
import { readFile } from "node:fs/promises";

function toMakesArray(map: Record<string, string>) {
  const makes = Object.entries(map).map(([name, id]) => ({
    id: String(id),
    n: String(name),
  }));
  // Sort by name for stable order
  makes.sort((a, b) => a.n.localeCompare(b.n));
  return makes;
}

type RawModel = { id: string | number; name: string; makeId: string | number };
function toModelsArray(list: RawModel[]) {
  return list.map((m) => ({
    id: String(m.id),
    n: String(m.name),
    m: String(m.makeId),
  }));
}

async function loadJson<T>(relPath: string): Promise<T> {
  const buf = await readFile(relPath, "utf-8");
  return JSON.parse(buf) as T;
}

export const GET: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const versionRaw = (import.meta.env.EXTENSION_DATA_VERSION as string | undefined) ?? "1";
  const version = Number.parseInt(versionRaw, 10) || 1;
  const makesMap = await loadJson<Record<string, string>>("ref/makeData.json");
  const rawModels = await loadJson<RawModel[]>("ref/brandData.clean.json");
  const makes = toMakesArray(makesMap);
  const models = toModelsArray(rawModels);
  const body = JSON.stringify({ version, makes, models });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
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
