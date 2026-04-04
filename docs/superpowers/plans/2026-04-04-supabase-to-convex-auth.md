# Supabase to Convex Auth Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase Auth with custom JWT auth backed by Convex, removing all Supabase dependencies.

**Architecture:** Users table in Convex stores email + bcrypt-hashed password. Login issues a signed JWT stored in an httpOnly cookie. All API endpoints validate the JWT instead of calling `supabase.auth.getUser()`. The Chrome extension flow (cookie → `/api/session` → `/api/token`) stays identical in shape.

**Tech Stack:** Convex (database), bcryptjs (password hashing), jsonwebtoken (JWT — already used), Astro 5.x SSR on Cloudflare Pages.

---

## File Structure

### New files
- `convex/users.ts` — User CRUD mutations/queries (signup, signin, getById, getByEmail)
- `src/lib/auth.ts` — Server-side auth helpers (verifySessionCookie, getAuthenticatedUser, setSessionCookie, clearSessionCookie)

### Modified files
- `convex/schema.ts` — Add `users` table
- `convex/subscriptions.ts` — Update userId type references
- `src/middleware.ts` — Replace Supabase with JWT verification
- `src/pages/auth/email-signin.ts` — Call Convex instead of Supabase
- `src/pages/auth/email-signup.ts` — Call Convex instead of Supabase
- `src/pages/auth/signout.ts` — Clear JWT cookie (no Supabase call)
- `src/pages/api/session.ts` — Use auth.ts helpers
- `src/pages/api/token.ts` — Use auth.ts helpers
- `src/pages/api/extension/verify.ts` — Use auth.ts helpers
- `src/pages/api/extension/log-missing.ts` — Use auth.ts helpers
- `src/pages/api/checkout.ts` — Use auth.ts helpers
- `src/pages/api/report.ts` — Use auth.ts helpers
- `src/pages/api/cancel.ts` — Use auth.ts helpers
- `src/pages/api/change-plan.ts` — Use auth.ts helpers
- `src/pages/api/portal.ts` — Use auth.ts helpers
- `src/pages/api/queue-cancel.ts` — Use auth.ts helpers
- `src/pages/api/reactivate.ts` — Use auth.ts helpers
- `src/pages/[locale]/auth/index.astro` — Remove Supabase client call
- `src/pages/dashboard.astro` — Use auth.ts helpers
- `src/pages/[locale]/dashboard.astro` — Use auth.ts helpers
- `package.json` — Remove `@supabase/ssr`, `@supabase/supabase-js`, add `bcryptjs`

### Deleted files
- `src/lib/supabase.ts`
- `src/pages/auth/callback.ts` (OAuth callback — OAuth removed for now)
- `src/pages/auth/oauth/github.ts`
- `src/pages/auth/oauth/google.ts`
- `src/pages/auth/signin.ts` (GitHub OAuth alias)

---

## Task 1: Add users table to Convex schema

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/users.ts`

- [ ] **Step 1: Update Convex schema with users table**

```typescript
// In convex/schema.ts, add this table to the defineSchema call:

  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"]),
```

- [ ] **Step 2: Create convex/users.ts with signup, signin, getById, getByEmail**

```typescript
// convex/users.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .unique();
  },
});

export const getById = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // userId is the Convex document ID as string
    try {
      return await ctx.db.get(args.userId as any);
    } catch {
      return null;
    }
  },
});

export const create = mutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .unique();
    if (existing) throw new Error("email_exists");

    return await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      passwordHash: args.passwordHash,
      name: args.name,
      createdAt: Date.now(),
    });
  },
});
```

- [ ] **Step 3: Push schema to Convex**

Run: `cd /Users/komer/Documents/projects/fast-scout-app && npx convex push`
Expected: Schema updated, `users` table created.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/users.ts
git commit -m "feat: add users table to Convex schema"
```

---

## Task 2: Create auth helpers library

**Files:**
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Install bcryptjs**

Run: `npm install bcryptjs && npm install -D @types/bcryptjs`

- [ ] **Step 2: Create src/lib/auth.ts**

```typescript
// src/lib/auth.ts
import jwt from "jsonwebtoken";
import type { AstroGlobal } from "astro";

interface SessionPayload {
  userId: string;
  email: string;
}

const COOKIE_NAME = "ab_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function getJwtSecret(): string {
  const secret = import.meta.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return secret;
}

function getCookieOptions(request: Request): {
  secure: boolean;
  sameSite: "none" | "lax";
  domain: string | undefined;
} {
  const url = new URL(request.url);
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const isSecure = url.protocol === "https:";
  return {
    secure: isSecure,
    sameSite: isSecure ? "none" : "lax",
    domain: isLocalhost ? undefined : `.${url.hostname}`,
  };
}

/**
 * Extract and verify the session JWT from the request cookie.
 * Returns { userId, email } or null if not authenticated.
 */
export function getAuthenticatedUser(request: Request): SessionPayload | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  try {
    const payload = jwt.verify(match[1], getJwtSecret()) as SessionPayload;
    if (!payload.userId || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie on an Astro response.
 */
export function setSessionCookie(
  cookies: AstroGlobal["cookies"],
  request: Request,
  userId: string,
  email: string,
): void {
  const token = jwt.sign({ userId, email }, getJwtSecret(), { expiresIn: "365d" });
  const opts = getCookieOptions(request);
  cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    domain: opts.domain,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * Clear the session cookie.
 */
export function clearSessionCookie(
  cookies: AstroGlobal["cookies"],
  request: Request,
): void {
  const opts = getCookieOptions(request);
  cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    domain: opts.domain,
    path: "/",
    maxAge: 0,
  });
}

/**
 * Set session cookie via raw Set-Cookie header (for API routes that return Response directly).
 */
export function makeSessionCookieHeader(request: Request, userId: string, email: string): string {
  const token = jwt.sign({ userId, email }, getJwtSecret(), { expiresIn: "365d" });
  const opts = getCookieOptions(request);
  const parts = [
    `${COOKIE_NAME}=${token}`,
    `Path=/`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    `HttpOnly`,
  ];
  if (opts.secure) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite === "none" ? "None" : "Lax"}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  return parts.join("; ");
}

export function makeClearCookieHeader(request: Request): string {
  const opts = getCookieOptions(request);
  const parts = [
    `${COOKIE_NAME}=`,
    `Path=/`,
    `Max-Age=0`,
    `HttpOnly`,
  ];
  if (opts.secure) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite === "none" ? "None" : "Lax"}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  return parts.join("; ");
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts package.json package-lock.json
git commit -m "feat: add custom JWT auth helpers for Convex migration"
```

---

## Task 3: Migrate auth endpoints (signin, signup, signout)

**Files:**
- Modify: `src/pages/auth/email-signin.ts`
- Modify: `src/pages/auth/email-signup.ts`
- Modify: `src/pages/auth/signout.ts`
- Delete: `src/pages/auth/callback.ts`
- Delete: `src/pages/auth/oauth/github.ts`
- Delete: `src/pages/auth/oauth/google.ts`
- Delete: `src/pages/auth/signin.ts`

- [ ] **Step 1: Rewrite email-signin.ts**

```typescript
// src/pages/auth/email-signin.ts
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
      Location: `/${locale}/dashboard`,
      "Set-Cookie": cookieHeader,
    },
  });
};
```

- [ ] **Step 2: Rewrite email-signup.ts**

```typescript
// src/pages/auth/email-signup.ts
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
```

- [ ] **Step 3: Rewrite signout.ts**

```typescript
// src/pages/auth/signout.ts
import type { APIRoute } from "astro";
import { makeClearCookieHeader } from "../../lib/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const cookieHeader = makeClearCookieHeader(ctx.request);
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": cookieHeader,
    },
  });
};
```

- [ ] **Step 4: Delete OAuth files**

```bash
rm src/pages/auth/callback.ts
rm src/pages/auth/signin.ts
rm -rf src/pages/auth/oauth/
```

- [ ] **Step 5: Commit**

```bash
git add -u src/pages/auth/
git commit -m "feat: migrate auth endpoints from Supabase to Convex"
```

---

## Task 4: Update middleware

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Replace Supabase auth check with JWT verification**

```typescript
// src/middleware.ts
import type { MiddlewareHandler } from "astro";
import { getAuthenticatedUser } from "./lib/auth";

function addSecurityHeaders(response: Response): Response {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const onRequest: MiddlewareHandler = async (ctx, next) => {
  const { url } = ctx;
  const pathname = new URL(url).pathname;

  // Protect dashboard: redirect to auth page if not logged in
  if (pathname.startsWith("/dashboard") || pathname.match(/^\/[a-z]{2}\/dashboard/)) {
    const user = getAuthenticatedUser(ctx.request);
    if (!user) {
      const locale = pathname.match(/^\/([a-z]{2})\//)?.[1] || "fr";
      return addSecurityHeaders(
        new Response(null, { status: 302, headers: { Location: `/${locale}/auth` } })
      );
    }
  }

  // Protect token endpoint: return 401 if not logged in
  if (pathname.startsWith("/api/token")) {
    const user = getAuthenticatedUser(ctx.request);
    if (!user) {
      return addSecurityHeaders(
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        })
      );
    }
  }

  const response = await next();
  return addSecurityHeaders(response);
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "refactor: replace Supabase middleware with JWT auth"
```

---

## Task 5: Update API endpoints

**Files:**
- Modify: `src/pages/api/session.ts`
- Modify: `src/pages/api/token.ts`
- Modify: `src/pages/api/extension/verify.ts`
- Modify: `src/pages/api/extension/log-missing.ts`
- Modify: `src/pages/api/checkout.ts`
- Modify: `src/pages/api/report.ts`
- Modify: `src/pages/api/cancel.ts`
- Modify: `src/pages/api/change-plan.ts`
- Modify: `src/pages/api/portal.ts`
- Modify: `src/pages/api/queue-cancel.ts`
- Modify: `src/pages/api/reactivate.ts`

Every endpoint that calls `supabase.auth.getUser()` must be replaced with `getAuthenticatedUser(request)`.

- [ ] **Step 1: Update session.ts**

Replace the Supabase user lookup:

```typescript
// In src/pages/api/session.ts
// Replace:
//   const supabase = getSupabaseServerClient(ctx as any);
//   const { data } = await supabase.auth.getUser();
//   const user = data.user;
//   if (!user) { ... }
//   const userId = user.id;
//   const email = user.email;
// With:
import { getAuthenticatedUser } from "../../lib/auth";
// ...
const sessionUser = getAuthenticatedUser(ctx.request);
if (!sessionUser) {
  return new Response(JSON.stringify({ authenticated: false }), {
    status: 200,
    headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
  });
}
const userId = sessionUser.userId;
const email = sessionUser.email;
```

Remove the `getSupabaseServerClient` import.

- [ ] **Step 2: Update token.ts**

Replace Supabase auth with:

```typescript
import { getAuthenticatedUser } from "../../lib/auth";
// ...
const sessionUser = getAuthenticatedUser(ctx.request);
if (!sessionUser) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
const email = sessionUser.email;
const userId = sessionUser.userId;
```

Remove `getSupabaseServerClient` import.

- [ ] **Step 3: Update extension/verify.ts**

Replace:
```typescript
// Remove: import { getSupabaseServerClient } from "../../../lib/supabase";
import { getAuthenticatedUser } from "../../../lib/auth";
// ...
// Replace supabase.auth.getUser() block with:
const sessionUser = getAuthenticatedUser(ctx.request);
if (!sessionUser) {
  return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
}
const userId = sessionUser.userId;
```

- [ ] **Step 4: Update extension/log-missing.ts**

Same pattern as verify.ts:
```typescript
import { getAuthenticatedUser } from "../../../lib/auth";
// Replace supabase.auth.getUser() with:
const sessionUser = getAuthenticatedUser(ctx.request);
if (!sessionUser) {
  return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
}
```

- [ ] **Step 5: Update all Stripe-related API endpoints**

For each of `checkout.ts`, `cancel.ts`, `change-plan.ts`, `portal.ts`, `queue-cancel.ts`, `reactivate.ts`, `report.ts`:

Replace:
```typescript
// Remove: const supabase = getSupabaseServerClient(ctx as any);
// Remove: const { data } = await supabase.auth.getUser();
// Remove: if (!data.user) ...
import { getAuthenticatedUser } from "../../lib/auth";
const sessionUser = getAuthenticatedUser(ctx.request);
if (!sessionUser) {
  return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
}
const userId = sessionUser.userId;
const email = sessionUser.email;
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/api/
git commit -m "refactor: replace Supabase auth with JWT in all API endpoints"
```

---

## Task 6: Update dashboard pages

**Files:**
- Modify: `src/pages/dashboard.astro`
- Modify: `src/pages/[locale]/dashboard.astro`
- Modify: `src/pages/[locale]/auth/index.astro`
- Modify: `src/pages/auth/index.astro`

- [ ] **Step 1: Update dashboard pages**

In both `dashboard.astro` and `[locale]/dashboard.astro`, replace:

```typescript
// Remove: const supabase = getSupabaseServerClient(Astro);
// Remove: const { data } = await supabase.auth.getUser();
// Remove: const userId = data.user?.id;
import { getAuthenticatedUser } from "../lib/auth"; // or "../../lib/auth" for [locale]
const sessionUser = getAuthenticatedUser(Astro.request);
if (!sessionUser) return Astro.redirect("/auth");
const userId = sessionUser.userId;
const email = sessionUser.email;
```

- [ ] **Step 2: Update auth pages**

In `[locale]/auth/index.astro` and `auth/index.astro`, replace the Supabase auth check (redirect if already logged in):

```typescript
// Remove: const supabase = getSupabaseServerClient(Astro);
// Remove: const { data } = await supabase.auth.getUser();
// Remove: if (data.user) return Astro.redirect("/dashboard");
import { getAuthenticatedUser } from "../../lib/auth"; // adjust path
const sessionUser = getAuthenticatedUser(Astro.request);
if (sessionUser) return Astro.redirect(`/${locale}/dashboard`);
```

Also remove the OAuth buttons from the login page HTML (Google/GitHub).

- [ ] **Step 3: Commit**

```bash
git add src/pages/dashboard.astro "src/pages/[locale]/dashboard.astro" "src/pages/[locale]/auth/index.astro" src/pages/auth/index.astro
git commit -m "refactor: replace Supabase auth with JWT in Astro pages"
```

---

## Task 7: Remove Supabase and clean up

**Files:**
- Delete: `src/lib/supabase.ts`
- Modify: `package.json`
- Modify: `.env`

- [ ] **Step 1: Delete supabase.ts**

```bash
rm src/lib/supabase.ts
```

- [ ] **Step 2: Remove Supabase dependencies**

```bash
npm uninstall @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 3: Clean .env — remove Supabase vars**

Remove these lines from `.env`:
```
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
```

Keep:
```
SITE_URL=http://localhost:4321
STRIPE_SECRET_KEY=...
STRIPE_PRICE_ID=...
(all Stripe vars)
JWT_SECRET=...
CHROME_EXTENSION_ID=...
CLOUDFLARE_API_TOKEN=...
CONVEX_DEPLOYMENT=...
CONVEX_URL=...
OPENROUTER_API_KEY=...
```

- [ ] **Step 4: Search for any remaining Supabase references**

Run: `grep -r "supabase" src/ --include="*.ts" --include="*.astro" -l`
Expected: No results. If any files remain, update them.

Run: `grep -r "supabase" convex/ -l`
Expected: No results.

- [ ] **Step 5: Build and verify**

Run: `npm run build` (or `npx astro build`)
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove Supabase dependencies, complete migration to Convex auth"
```

---

## Task 8: Migrate existing users from Supabase to Convex

**Files:**
- None (one-time script)

- [ ] **Step 1: Get existing Supabase users**

Known users (from Supabase query):
```
f1ec14dc-4982-46ee-b581-47d64d321e3e | omer@banana-navy.com
81a26ca4-f10a-416c-8edf-653a3e9d4e20 | gary@banana-navy.com
7972660f-d9f9-4f45-b77b-17acac678a0b | mac@mac-jb.be
21275b6a-a5ff-4533-be1e-9087dba52dd3 | omer@paymen.io
```

- [ ] **Step 2: Create users in Convex with temporary passwords**

For each user, run:
```bash
# Generate a bcrypt hash for a temporary password (user will reset later)
node -e "const b=require('bcryptjs');b.hash('TempPass123!',10).then(h=>console.log(h))"
```

Then insert into Convex:
```bash
npx convex run users:create '{"email": "omer@banana-navy.com", "passwordHash": "<hash>", "name": "Omer"}'
npx convex run users:create '{"email": "gary@banana-navy.com", "passwordHash": "<hash>", "name": "Gary"}'
npx convex run users:create '{"email": "mac@mac-jb.be", "passwordHash": "<hash>"}'
npx convex run users:create '{"email": "omer@paymen.io", "passwordHash": "<hash>"}'
```

- [ ] **Step 3: Update subscriptionStatus records with new Convex user IDs**

The existing `subscriptionStatus` record for `omer@banana-navy.com` uses the old Supabase UUID (`f1ec14dc-...`). Update it to use the new Convex user `_id`:

```bash
# Get the new Convex user ID
npx convex run users:getByEmail '{"email": "omer@banana-navy.com"}'
# Note the _id field

# Update subscription
npx convex run subscriptions:upsert '{"userId": "<new_convex_id>", "active": true, "priceId": "master_free", "currentPeriodEnd": "2099-12-31"}'

# Delete old subscription record with Supabase UUID
# (via Convex dashboard or a one-time mutation)
```

---

## Task 9: Deploy and verify

- [ ] **Step 1: Push Convex schema**

Run: `npx convex push`

- [ ] **Step 2: Deploy to Cloudflare Pages**

```bash
npx astro build
wrangler pages deploy dist --project-name autobridge-app --branch main
```

- [ ] **Step 3: Add/update Cloudflare secrets**

Remove Supabase secrets, ensure JWT_SECRET is set:
```bash
echo "<jwt_secret>" | wrangler pages secret put JWT_SECRET --project-name autobridge-app
```

- [ ] **Step 4: Test auth flows**

1. Open `https://autobridge-app.pages.dev/auth`
2. Sign in with `omer@banana-navy.com` + temp password
3. Verify redirect to `/dashboard`
4. Verify `/api/session` returns `{ authenticated: true, email: "omer@banana-navy.com", ... }`
5. Open Chrome extension → verify it can authenticate (session + token flow)
6. Test sign out

- [ ] **Step 5: Test extension AI verification**

1. Navigate to a FastBack vehicle page
2. Verify badges appear on buttons
3. Verify verification panel shows in FAB area

---

## Summary

| Phase | Task | Est. |
|-------|------|------|
| Schema | Task 1: Users table | 5 min |
| Auth lib | Task 2: JWT helpers | 10 min |
| Auth endpoints | Task 3: Signin/signup/signout | 10 min |
| Middleware | Task 4: JWT middleware | 5 min |
| API endpoints | Task 5: All 11 API routes | 15 min |
| Pages | Task 6: Dashboard + auth pages | 10 min |
| Cleanup | Task 7: Remove Supabase | 5 min |
| Data | Task 8: Migrate users | 10 min |
| Deploy | Task 9: Deploy + verify | 10 min |
| **Total** | | **~80 min** |
