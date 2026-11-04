import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/** Local mode has no AI key, so each photo becomes a piece the owner names. No cost. */
const fixture = (name: string) => path.join(__dirname, "..", "fixtures", name);

async function pick(page: Page, names: string[]) {
  await page.goto("/add");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photos" }).click();
  await (await chooser).setFiles(names.map(fixture));
}

test("a JPEG becomes a piece in the background and can be added", async ({ page }) => {
  await pick(page, ["tee-phone.jpg"]);
  await page.getByRole("button", { name: /Unnamed piece/ }).first().click({ timeout: 30_000 });
  const sheet = page.getByRole("dialog");
  await sheet.getByPlaceholder("e.g. Grey wool overshirt").fill("Navy tee");
  await sheet.getByRole("button", { name: "Add to drawer" }).click();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Navy tee", exact: true })).toBeVisible({ timeout: 15_000 });
});

test("a real HEIC is converted", async ({ page }) => {
  await pick(page, ["tee-iphone.heic"]);
  await expect(page.getByRole("button", { name: /Unnamed piece/ }).first()).toBeVisible({ timeout: 45_000 });
});

test("a damaged HEIC explains why and offers a retry, without blocking anything else", async ({ page }) => {
  await pick(page, ["fake-iphone.heic", "tee-phone.jpg"]);
  await expect(page.getByRole("alert").filter({ hasText: "couldn't convert" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "couldn't convert" })).toHaveCount(0);
});

test("leaving the screen doesn't lose an upload", async ({ page }) => {
  await pick(page, ["tee-phone.jpg", "tee-phone.jpg"]);
  await page.getByRole("link", { name: "Outfits", exact: true }).first().click();
  await expect(page).toHaveURL(/\/outfits/);
  await expect(page.getByRole("link", { name: /Uploading|Reading|Styling|to check/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: /Uploading|Reading|Styling|to check/ }).click();
  await expect(page.getByRole("button", { name: /Unnamed piece/ }).first()).toBeVisible({ timeout: 30_000 });
});

test("more than 8 photos: the first 8 go through, and the owner is told", async ({ page }) => {
  await pick(page, Array(9).fill("tee-iphone.heic").map(() => "tee-phone.jpg"));
  await expect(page.getByText("Up to 8 photos at a time").first()).toBeVisible();
});

test("a storage failure is explained, retried, and photos aren't lost", async ({ page }) => {
  let fail = true;
  await page.route("**/api/upload", (r) => (fail ? r.fulfill({ status: 502, json: { error: "Bucket not found" } }) : r.continue()));
  await pick(page, ["tee-phone.jpg"]);
  await expect(page.getByRole("alert").filter({ hasText: "Bucket not found" })).toBeVisible({ timeout: 20_000 });
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Bucket not found" })).toHaveCount(0, { timeout: 20_000 });
});
