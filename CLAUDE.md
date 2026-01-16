# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FastScout Site is an Astro-based web application that provides authentication, subscription billing, and JWT token issuance for the FastScout Bridge Chrome extension. It integrates with Supabase for auth and database, and Stripe for subscription payments.

## Development Commands

```bash
# Start development server (http://localhost:4321)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

### Core Stack
- **Framework**: Astro 5.x with SSR mode (`output: "server"`)
- **Deployment**: Vercel adapter
- **Auth**: Supabase Auth (OAuth providers: GitHub, Google; Email magic links)
- **Payments**: Stripe subscriptions
- **Database**: Supabase (PostgreSQL)

### Directory Structure
```
src/
├── lib/           # Shared utilities
│   ├── supabase.ts  # Server/browser Supabase clients
│   ├── stripe.ts    # Stripe client and subscription helpers
│   └── cors.ts      # CORS handling for Chrome extension
├── middleware.ts    # Auth guard for /dashboard and /api/token
├── pages/
│   ├── api/         # API endpoints (all POST routes use formData)
│   ├── auth/        # Auth flows (OAuth callbacks, email signin)
│   └── *.astro      # Page components
├── shared/
│   └── Layout.astro # Common page layout with header/footer
└── types/           # TypeScript declarations
```

### Key Patterns

**API Routes**: All billing API routes follow this pattern:
1. Handle CORS preflight (`preflight()` / `corsHeaders()`)
2. Get Supabase client via `getSupabaseServerClient(ctx)`
3. Check rate limit via `supabase.rpc("check_rate_limit", {...})`
4. Delegate to Stripe Wrapper Edge Function if `STRIPE_WRAPPER_BASE_URL` is set, otherwise call Stripe directly
5. Return redirect responses with error/success query params

**Auth Middleware** (`src/middleware.ts`): Protects `/dashboard` and `/api/token` routes. Redirects unauthenticated users to `/auth` or returns 401.

**Supabase Client** (`src/lib/supabase.ts`): Creates server-side client with cookie handling. Domain and secure flags derived from `SITE_URL`.

**Chrome Extension CORS** (`src/lib/cors.ts`): Allows CORS only for `chrome-extension://<CHROME_EXTENSION_ID>` origin.

### Database Tables (Supabase)
- `subscription_status`: Cached subscription state per user (active, price_id, current_period_end)
- `billing_customers`: Maps user_id to stripe_customer_id
- `rate_limits`: Used by `check_rate_limit` RPC function

### Stripe Integration
Two modes of operation:
1. **Edge Function Mode**: When `STRIPE_WRAPPER_BASE_URL` is set, privileged Stripe operations delegate to a Supabase Edge Function that runs with service-role credentials
2. **Direct Mode**: Falls back to calling Stripe API directly from the web app

## Environment Variables

Required in `.env`:
- `SITE_URL`: Base URL for callbacks (e.g., `http://localhost:4321`)
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`: Supabase project
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

The app deploys to Vercel. For Supabase Edge Functions:
```bash
supabase functions deploy stripe-wrapper
```
