import { defineConfig } from "@playwright/test";

/** Runs against a local-mode production build: no Supabase, no AI key, nothing saved to .data/. */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  // The app's service worker fetches same-origin requests itself, which would bypass page.route().
  use: { baseURL: "http://localhost:3100", serviceWorkers: "block" },
  webServer: {
    command: "pnpm build && pnpm exec next start -p 3100",
    url: "http://localhost:3100",
    timeout: 300_000,
    reuseExistingServer: false,
    env: { OPENAI_API_KEY: "", LOCAL_PERSIST: "0", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
  },
});
