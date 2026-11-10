import { defineConfig } from "@playwright/test";
const port = Number(process.env.E2E_PORT || 3100);

/** Runs against a local-mode production build: no Supabase, no AI key, nothing saved to .data/. */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  // The app's service worker fetches same-origin requests itself, which would bypass page.route().
  use: { baseURL: `http://localhost:${port}`, serviceWorkers: "block" },
  webServer: {
    command: `pnpm build && node node_modules/next/dist/bin/next start -p ${port}`,
    url: `http://localhost:${port}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { OPENAI_API_KEY: "", LOCAL_PERSIST: "0", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
  },
});
