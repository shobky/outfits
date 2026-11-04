---
name: verify-ui
description: Visually verify Drawer UI changes on mobile and desktop with Playwright screenshots and a scripted click-through.
---
# Verify UI

1. `pnpm build && PORT=3100 pnpm start &` (demo mode works with no env).
2. Playwright is preinstalled in cloud sessions (`require('playwright')`); locally `npx playwright install chromium`.
3. Capture at least: `devices['iPhone 14 Pro']` and `{ width: 1440, height: 900 }`, dark (default) and light (`localStorage.theme = 'light'`).
4. Core flows to click through:
   - `/` drawer → open an item sheet → toggle favorite/laundry
   - `/stylist` → tap "Dinner date tonight — style me" → wait for "Save outfit" → expand steps drawer
   - `/stylist` → "What should I wear today?" → quick reply chips appear → tap one → outfit board
   - `/outfits`, `/shop`, `/me`, `/add`
5. Watch `pageerror` / console errors. Look at the screenshots — check spacing, overflow at 390px, contrast in both themes.
