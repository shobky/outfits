import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "brand-verify.spec.ts", workers: 1, timeout: 60000,
  use: { baseURL: "http://localhost:3202", serviceWorkers: "block" },
  webServer: {
    cwd: "D:/outfits",
    command: "pnpm build && pnpm exec next start -p 3202", url: "http://localhost:3202", timeout: 300000,
    env: { OPENAI_API_KEY: "", LOCAL_PERSIST: "0", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
  },
});
