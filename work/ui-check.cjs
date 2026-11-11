/* eslint-disable @typescript-eslint/no-require-imports -- standalone Playwright verification script */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");

(async () => {
  fs.mkdirSync("screenshots/review-final", { recursive: true });
  const browser = await chromium.launch({ headless: true });
  for (const view of [{ name: "mobile-dark", width: 390, height: 844 }, { name: "desktop-dark", width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport: { width: view.width, height: view.height } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
    for (const route of ["/", "/stylist", "/me", "/outfits", "/shop", "/add"]) {
      try { await page.goto(`http://localhost:3100${route}`, { waitUntil: "domcontentloaded", timeout: 15000 }); } catch (error) { console.log(view.name, route, "navigation", error.message); }
      await page.screenshot({ path: `screenshots/review-final/${view.name}-${route === "/" ? "drawer" : route.slice(1)}.png`, fullPage: true });
      console.log(view.name, route, await page.title(), "h1=", await page.locator("h1").allTextContents());
    }
    console.log(view.name, errors);
    await page.close();
  }
  const light = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await light.goto("http://localhost:3100/me", { waitUntil: "domcontentloaded", timeout: 15000 });
  await light.evaluate(() => localStorage.setItem("theme", "light"));
  await light.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
  await light.screenshot({ path: "screenshots/review-final/mobile-light-profile.png", fullPage: true });
  console.log("mobile-light", await light.locator("h1").allTextContents());
  await browser.close();
})();
