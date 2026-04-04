import type { APIRoute } from "astro";
import { makeClearCookieHeader } from "../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const cookieHeader = makeClearCookieHeader(ctx.request);
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": cookieHeader,
    },
  });
};
