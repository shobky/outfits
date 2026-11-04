import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixture = (name: string) => path.join(__dirname, "..", "fixtures", name);
const MODEL_HOST = "https://staticimgly.com/**";

async function pick(page: Page, name: string) {
  await page.goto("/add");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photos" }).click();
  await (await chooser).setFiles(fixture(name));
}

async function saveAs(page: Page, name: string, button = "Add to drawer") {
  await page.getByPlaceholder("e.g. Grey wool overshirt").fill(name);
  await page.getByRole("button", { name: button }).click();
  await expect(page.getByText(new RegExp(`${name}.*added`)).first()).toBeVisible({ timeout: 15_000 });
}

test.describe("with the cut-out model unreachable", () => {
  test.beforeEach(({ page }) => page.route(MODEL_HOST, (r) => r.abort()));

  test("JPEG still saves, using the original photo", async ({ page }) => {
    await pick(page, "tee-phone.jpg");
    await expect(page.getByText("couldn't remove the background").first()).toBeVisible({ timeout: 45_000 });
    await saveAs(page, "Fallback tee");
  });

  test("a real HEIC with a .heic name is converted and saved", async ({ page }) => {
    await pick(page, "tee-iphone.heic");
    await expect(page.getByText("couldn't remove the background").first()).toBeVisible({ timeout: 45_000 });
    await saveAs(page, "Heic tee");
  });

  test("a damaged HEIC shows the reason and can be saved without a photo", async ({ page }) => {
    await pick(page, "fake-iphone.heic");
    await expect(page.getByRole("alert").filter({ hasText: "couldn't convert" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await saveAs(page, "No photo tee", "Save without photo");
  });

  test("saving works before the cut-out finishes", async ({ page }) => {
    await page.unroute(MODEL_HOST);
    await page.route(MODEL_HOST, () => {}); // never answers
    await pick(page, "tee-phone.jpg");
    await expect(page.getByText("Removing background")).toBeVisible({ timeout: 20_000 });
    await saveAs(page, "Early tee");
  });

  test("a storage failure is explained and the piece is still saved", async ({ page }) => {
    await page.route("**/api/upload", (r) => r.fulfill({ status: 502, json: { error: "Storage rejected the image: Bucket not found" } }));
    await pick(page, "tee-phone.jpg");
    await expect(page.getByText("couldn't remove the background").first()).toBeVisible({ timeout: 45_000 });
    await page.getByPlaceholder("e.g. Grey wool overshirt").fill("Offline tee");
    await page.getByRole("button", { name: "Add to drawer" }).click();
    await expect(page.getByText(/Offline tee saved.*Bucket not found/)).toBeVisible();
  });

  test("a failed save keeps the piece on screen with the reason", async ({ page }) => {
    await page.route("**/api/items", (r) => (r.request().method() === "POST" ? r.fulfill({ status: 500, json: { error: "database down" } }) : r.continue()));
    await pick(page, "tee-phone.jpg");
    await expect(page.getByText("couldn't remove the background").first()).toBeVisible({ timeout: 45_000 });
    await page.getByPlaceholder("e.g. Grey wool overshirt").fill("Lost tee");
    await page.getByRole("button", { name: "Add to drawer" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "database down" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to drawer" })).toBeEnabled();
  });
});

test("full pipeline with the real cut-out model", async ({ page }) => {
  test.setTimeout(330_000);
  await pick(page, "tee-phone.jpg");
  await expect(page.getByText("Details weren't filled in automatically")).toBeVisible({ timeout: 300_000 });
  await expect(page.getByText("couldn't remove the background")).toHaveCount(0);
  await saveAs(page, "Real tee");
});
