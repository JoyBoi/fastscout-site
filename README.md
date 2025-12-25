# FastScout Site (Astro)

Astro web app for FastScout Bridge. Provides:

- Auth via Auth.js (GitHub OAuth)
- Stripe subscription checkout and billing portal
- JWT token endpoint for the extension

## Quickstart

1. Copy `.env.example` to `.env` and fill values.
2. Install deps: `npm install`
3. Start dev: `npm run dev` (default `http://localhost:4321`)

## Environment Variables

- `SITE_URL`: Base URL for callbacks and redirects
- `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`: Supabase project credentials
- `STRIPE_SECRET_KEY`: Stripe API key (server-side only, used by Edge Function)
- `STRIPE_PRICE_ID`: Subscription price ID
- `STRIPE_WRAPPER_BASE_URL`: Supabase Edge Function base URL for Stripe Wrapper
- `JWT_SECRET`: Secret for signing extension tokens

Notes:
- Do NOT expose `SUPABASE_SERVICE_ROLE_KEY` in the web app. Configure it only as a secret on Supabase Edge Functions.

## Endpoints

- `/auth/*`: Supabase OAuth sign-in/sign-out
- `POST /api/checkout`: Proxies to Edge Function to create Stripe Checkout session
- `GET /api/portal`: Proxies to Edge Function to open Stripe Customer Portal
- `POST /api/token`: Issue JWT for the extension (requires active subscription)

## Extension Integration

- After login, the extension can call `POST /api/token` with cookies to retrieve a JWT.
- Set the extension's `VITE_AUTH_BASE_URL` to your deployed site base URL.

## Security

- Privileged operations (Stripe customer/session creation, webhooks, subscription caching) run in a Supabase Edge Function with service-role credentials.
- The web app only calls the Edge Function with a user access token (Authorization: Bearer).
- Rate limiting and audit logs enabled on Edge Function.

## Supabase Setup

- Enable GitHub OAuth: Auth → Providers → GitHub → set Client ID/Secret
- Set callback URL: `${SITE_URL}/auth/callback`
- Create table/function for rate limiting:
  - Migration added at `supabase/migrations/0001_rate_limits.sql`
  - Apply via Supabase SQL editor or CLI:
    - `supabase db push` after linking your project with `supabase link`

## Edge Function Secrets

- Configure secrets only for the Edge Function (not in the app):
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_ID`
  - `SITE_URL`

Deploy:
- `supabase functions deploy stripe-wrapper`
