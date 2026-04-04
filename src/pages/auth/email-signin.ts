import type { APIRoute } from "astro";
import bcrypt from "bcryptjs";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { makeSessionCookieHeader } from "../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const formData = await ctx.request.formData();
  const email = formData.get("email")?.toString()?.trim()?.toLowerCase();
  const password = formData.get("password")?.toString();
  const locale = formData.get("locale")?.toString() || "fr";

  if (!email || !password) {
    return ctx.redirect(`/${locale}/auth?error=missing_fields`);
  }

  const convex = getConvexClient();
  const user = await convex.query(api.users.getByEmail, { email });

  if (!user || !user.passwordHash) {
    return ctx.redirect(`/${locale}/auth?error=invalid_credentials`);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return ctx.redirect(`/${locale}/auth?error=invalid_credentials`);
  }

  const cookieHeader = makeSessionCookieHeader(ctx.request, user._id, user.email);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/${locale}/dashboard?welcome=1`,
      "Set-Cookie": cookieHeader,
    },
  });
};
