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

  if (password.length < 8) {
    return ctx.redirect(`/${locale}/auth?error=weak_password&mode=signup`);
  }

  const convex = getConvexClient();
  const passwordHash = await bcrypt.hash(password, 10);

  let userId: string;
  try {
    userId = await convex.mutation(api.users.create, {
      email,
      passwordHash,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("email_exists")) {
      return ctx.redirect(`/${locale}/auth?error=email_exists&mode=signup`);
    }
    return ctx.redirect(`/${locale}/auth?error=signup_failed&mode=signup`);
  }

  const cookieHeader = makeSessionCookieHeader(ctx.request, userId, email);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/${locale}/dashboard`,
      "Set-Cookie": cookieHeader,
    },
  });
};
