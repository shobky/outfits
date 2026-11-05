import path from "node:path";
import { expect, test } from "@playwright/test";

/** Layout checks and screenshots for looking over by hand: 390px and 1440px, dark and light. */
const SHOTS = path.join("test-results", "screens");
const sizes = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
];

for (const size of sizes) {
  for (const theme of ["dark", "light"]) {
    test(`${size.name} ${theme}: no sideways scroll or page errors`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);

      for (const [name, url] of [["drawer", "/"], ["outfits", "/outfits"], ["add", "/add"], ["shop", "/shop"], ["me", "/me"]]) {
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        await page.screenshot({ path: path.join(SHOTS, `${size.name}-${theme}-${name}.png`) });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name} scrolls sideways`).toBe(true);
      }

      await page.goto("/");
      await page.getByRole("button", { name: "Stone chinos", exact: true }).click();
      await expect(page.getByRole("dialog").getByRole("button", { name: "Show Front photo" })).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SHOTS, `${size.name}-${theme}-sheet.png`) });

      await page.goto("/stylist?q=Give%20me%20two%20looks%20for%20a%20date");
      await expect(page.getByRole("button", { name: "Wore it today" })).toHaveCount(2, { timeout: 30_000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOTS, `${size.name}-${theme}-stylist.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "stylist scrolls sideways").toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

test("the login page shows why a link failed", async ({ page }) => {
  // Local mode has no login gate, so the page is reachable directly here.
  await page.goto("/login?error=auth");
  await expect(page.getByRole("alert").filter({ hasText: "didn't work" })).toBeVisible();
});

test("ChatGPT sign-in is offered on this computer and hidden anywhere else", async ({ page, request }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Continue with ChatGPT" })).toHaveAttribute("data-oai-siwc-button", "");
  await expect(page.getByText("No API key needed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeVisible();

  const start = await request.get("http://127.0.0.1:3100/auth/chatgpt/start", { maxRedirects: 0 });
  const authorize = new URL(start.headers().location);
  expect(authorize.origin).toBe("https://auth.openai.com");
  expect(authorize.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3100/auth/callback");
  expect(authorize.searchParams.get("scope")).toContain("chatgpt.tokens.use.direct");

  const hosted = await request.get("/auth/chatgpt/status", { headers: { host: "outfits.example.com" } });
  expect((await hosted.json()).available).toBe(false);
});
