import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const artifactRoot = process.env.UI_ARTIFACT_DIR ?? path.join(process.cwd(), "screenshots", "tryon");

test.describe("try-on profile UI", () => {
  test("shows a guided profile setup with accessible photo roles", async ({ page }, testInfo) => {
    for (const mode of ["dark", "light"] as const) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/me#try-on-profile");
      await page.evaluate((theme) => localStorage.setItem("theme", theme), mode);
      await page.reload();
      const setup = page.locator("#try-on-profile");
      await expect(setup.getByRole("heading", { name: "Your try-on profile" })).toBeVisible();
      await expect(setup.getByRole("button", { name: /Full body photo/ })).toBeVisible();
      await expect(setup.getByRole("button", { name: /Face & shoulders photo/ })).toBeVisible();
      await expect(setup.getByRole("button", { name: /Side view photo/ })).toBeVisible();
      await expect(setup.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "6");

      const dir = path.join(artifactRoot, testInfo.project.name);
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `tryon-profile-390-${mode}.png`), fullPage: true });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: path.join(dir, `tryon-profile-1440-${mode}.png`), fullPage: true });
    }
  });

  test("try-on sheet points people to the complete profile setup", async ({ page }) => {
    const feature = await page.request.post("/api/dev", { data: { feature: "try_on", on: true } });
    expect(feature.ok()).toBe(true);
    await page.goto("/outfits");
    const trigger = page.getByRole("button", { name: "Try it on" }).first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Add a photo of yourself")).toBeVisible();
    await expect(sheet.getByRole("link", { name: /Set up all profile angles/ })).toHaveAttribute("href", "/me#try-on-profile");
  });

  test("preview supports comparison, detail, download, retry errors and selection invalidation", async ({ page }) => {
    await page.request.post("/api/dev", { data: { feature: "try_on", on: true } });
    await page.request.delete("/api/try-on/photo");
    await page.goto("/outfits");
    await page.getByRole("button", { name: "Try it on" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Try it on", exact: true });
    let profileWrites = 0;
    page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/api/try-on/photo")) profileWrites++; });
    await sheet.getByTestId("try-on-photo").setInputFiles(path.join(__dirname, "../fixtures/tee-phone.jpg"));
    await expect(sheet.getByRole("button", { name: "See it on me" })).toBeVisible();
    expect(profileWrites).toBe(0);
    expect((await (await page.request.get("/api/profile")).json()).profile.try_on_photo_url).toBeNull();
    let fail = false;
    await page.route("**/api/try-on", (route) => route.request().method() === "POST" ? route.fulfill(fail ? { status: 502, json: { error: "Please retry this preview" } } : { json: { url: "/demo/tee-white.svg" } }) : route.fulfill({ json: { ok: true } }));
    await sheet.getByRole("button", { name: "See it on me" }).click();
    await expect(sheet.getByRole("link", { name: "Download image" })).toHaveAttribute("download", "outfits-try-on.jpg");
    await sheet.getByRole("button", { name: "Original", exact: true }).click();
    await expect(sheet.getByAltText("Original reference photo")).toBeVisible();
    await sheet.getByRole("button", { name: "AI result", exact: true }).click();
    await sheet.getByRole("button", { name: "Open preview detail" }).click();
    const detail = page.getByRole("dialog", { name: "Your AI preview", exact: true });
    await expect(detail.getByAltText("Try-on detail")).toBeVisible();
    await detail.getByRole("button", { name: "Close" }).click();
    fail = true;
    await sheet.getByRole("button", { name: "Recreate · uses 1 try-on" }).click();
    await expect(page.getByText("Please retry this preview")).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Download image" })).toBeVisible();
    await sheet.getByRole("button", { name: /^Remove / }).filter({ has: page.locator("img") }).first().click();
    await expect(sheet.getByRole("link", { name: "Download image" })).toHaveCount(0);
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await page.request.delete("/api/try-on/photo");
  });
});
