/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SITE_URL: string;
  readonly OPENROUTER_API_KEY: string;
  readonly CONVEX_URL: string;
  readonly STRIPE_SECRET_KEY: string;
  readonly STRIPE_PRICE_ID: string;
  readonly STRIPE_PRICE_ID_MONTHLY: string;
  readonly STRIPE_PRICE_ID_YEARLY: string;
  readonly STRIPE_PRICE_ID_QUARTERLY: string;
  readonly STRIPE_PRICE_ID_HALFYEARLY: string;
  readonly STRIPE_WRAPPER_BASE_URL: string;
  readonly JWT_SECRET: string;
  readonly CHROME_EXTENSION_ID: string;
  readonly EXTENSION_DATA_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
