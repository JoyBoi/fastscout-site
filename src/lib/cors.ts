export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const id = (import.meta.env.CHROME_EXTENSION_ID as string | undefined)?.trim();
  const extOrigin = id ? `chrome-extension://${id}` : "";
  if (origin && id && origin === extOrigin) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type, authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Vary": "Origin",
    } as Record<string, string>;
  }
  return {} as Record<string, string>;
}

export function preflight(req: Request) {
  if (req.method === "OPTIONS") {
    const headers = corsHeaders(req);
    return new Response(null, { status: 204, headers });
  }
  return null;
}

