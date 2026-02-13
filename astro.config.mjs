import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  adapter: vercel(),

  i18n: {
    defaultLocale: "fr",
    locales: ["fr", "en", "nl"],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },

  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },

  vite: {
    plugins: [tailwindcss()],
  },
});