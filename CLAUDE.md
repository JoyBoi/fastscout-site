# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutoBridge is an Astro-based web application that provides authentication, subscription billing, and JWT token issuance for the AutoBridge Chrome extension. It uses Supabase for auth, Convex for the database, and Stripe for subscription payments.

## Development Commands

```bash
# Start development server (http://localhost:4321)
npm run dev

# Start Convex dev (separate terminal)
npx convex dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

### Core Stack
- **Framework**: Astro 5.x with SSR mode (`output: "server"`)
- **Deployment**: Cloudflare Pages (`@astrojs/cloudflare` adapter)
- **Auth**: Supabase Auth (OAuth providers: GitHub, Google; Email/password)
- **Database**: Convex (document database)
- **Payments**: Stripe subscriptions

### Directory Structure
```
src/
├── lib/           # Shared utilities
│   ├── supabase.ts  # Supabase Auth client (auth only)
│   ├── convex.ts    # ConvexHttpClient singleton
│   ├── stripe.ts    # Stripe client and subscription helpers
│   └── cors.ts      # CORS handling for Chrome extension
├── middleware.ts    # Auth guard for /dashboard and /api/token
├── pages/
│   ├── api/         # API endpoints
│   ├── auth/        # Auth flows (OAuth callbacks, email signin)
│   └── *.astro      # Page components
├── shared/
│   └── Layout.astro # Common page layout with header/footer
└── types/           # TypeScript declarations
convex/
├── schema.ts          # Database schema (all tables)
├── appConfig.ts       # App config queries/mutations
├── makes.ts           # Vehicle makes queries
├── models.ts          # Vehicle models queries
├── missingEntries.ts  # Missing vehicle data mutations
├── rateLimit.ts       # Rate limiting mutation
├── subscriptions.ts   # Subscription status cache
├── billingCustomers.ts # User-to-Stripe customer mapping
├── reports.ts         # User feedback reports
└── extensionData.ts   # Combined extension data query
```

### Key Patterns

**API Routes**: All billing API routes follow this pattern:
1. Handle CORS preflight (`preflight()` / `corsHeaders()`)
2. Get Supabase auth user via `getSupabaseServerClient(ctx).auth.getUser()`
3. Check rate limit via `convex.mutation(api.rateLimit.checkRateLimit, {...})`
4. Delegate to Stripe Wrapper Edge Function if `STRIPE_WRAPPER_BASE_URL` is set, otherwise call Stripe directly
5. Return redirect responses with error/success query params

**Auth**: Supabase Auth handles OAuth, email/password, and session management. Convex handles ALL database operations. The middleware uses Supabase Auth to verify sessions.

**Convex Client** (`src/lib/convex.ts`): Singleton `ConvexHttpClient` using `CONVEX_URL` env var.

**Chrome Extension CORS** (`src/lib/cors.ts`): Allows CORS only for `chrome-extension://<CHROME_EXTENSION_ID>` origin.

### Convex Tables
- `subscriptionStatus`: Cached subscription state per user (active, priceId, currentPeriodEnd)
- `billingCustomers`: Maps userId to stripeCustomerId
- `rateLimitEvents`: Rate limiting events per user/action
- `makes` / `models`: Vehicle data for extension
- `missingEntries`: Logged missing vehicle data
- `appConfig`: Key-value config (e.g., brand_data_version)
- `reports`: User-submitted bug/feature reports

### Stripe Integration
Two modes of operation:
1. **Edge Function Mode**: When `STRIPE_WRAPPER_BASE_URL` is set, privileged Stripe operations delegate to a Supabase Edge Function
2. **Direct Mode**: Falls back to calling Stripe API directly from the web app

## Environment Variables

Required in `.env`:
- `CONVEX_URL`: Convex deployment URL
- `CONVEX_DEPLOYMENT`: Convex deployment name (e.g., `prod:flippant-retriever-90`)
- `SITE_URL`: Base URL for callbacks (e.g., `http://localhost:4321`)
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`: Supabase project (auth only)
- `STRIPE_SECRET_KEY`: Stripe API key
- `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_YEARLY`: Subscription price IDs
- `JWT_SECRET`: Secret for signing extension tokens (min 16 chars)
- `CHROME_EXTENSION_ID`: Extension ID for CORS whitelist

Optional:
- `STRIPE_WRAPPER_BASE_URL`: Supabase Edge Function URL for privileged ops
- `STRIPE_PRICE_ID_QUARTERLY`, `STRIPE_PRICE_ID_HALFYEARLY`: Additional price tiers

## Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/session` | GET | Returns auth state and subscription status |
| `/api/token` | POST | Issues JWT for Chrome extension (requires active subscription) |
| `/api/checkout` | POST | Creates Stripe checkout session |
| `/api/change-plan` | POST | Schedules plan change at period end |
| `/api/portal` | GET | Redirects to Stripe Customer Portal |
| `/api/cancel` | POST | Cancels subscription |
| `/api/reactivate` | POST | Reactivates canceled subscription |

## Deployment

The app deploys to **Cloudflare Pages** (project: `autobridge-app`).

```bash
# Deploy Convex functions to production
npx convex deploy --cmd 'echo skip'

# Build and deploy to Cloudflare Pages
npm run build && npx wrangler pages deploy dist

# Deploy Supabase Edge Functions (for Stripe wrapper)
supabase functions deploy stripe-wrapper
```

Configuration is in `wrangler.toml`. Environment variables must be set in the Cloudflare Pages dashboard or via:
```bash
npx wrangler pages secret put <SECRET_NAME>
```
