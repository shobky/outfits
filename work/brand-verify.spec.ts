import { test, expect } from "@playwright/test";
import path from "node:path";

test("branding metadata and all declared icons resolve", async ({ page, request }) => {
  await page.goto("/login");
  const manifestResponse = await request.get("/manifest.webmanifest");
  const manifest = await manifestResponse.json();
  expect(manifest.icons).toHaveLength(4);
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  const apple = await page.locator('link[rel="apple-touch-icon"]').evaluateAll(nodes => nodes.map(node => node.getAttribute("href")!));
  expect(apple).toHaveLength(4);
  for (const icon of apple) expect((await request.get(icon)).status()).toBe(200);
  expect((await request.get("/favicon.ico")).status()).toBe(200);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /brand\/social-card.jpg$/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  expect((await request.get("/brand/social-card.jpg")).status()).toBe(200);
});

for (const width of [390, 1440]) for (const theme of ["dark", "light"]) {
  test(`brand at ${width}px in ${theme}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.addInitScript(value => localStorage.setItem("theme", value), theme);
    for (const [name, route] of [["login", "/login"], ["drawer", "/"], ["stylist", "/stylist"]]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      if (name !== "drawer" || width === 1440) {
        const mark = page.locator('img[src="/brand/logo.webp"]').filter({ visible: true }).first();
        await expect(mark).toBeVisible();
        expect(await mark.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: path.join("work", "brand-preview", `${width}-${theme}-${name}.png`) });
    }
    expect(errors).toEqual([]);
  });
}
