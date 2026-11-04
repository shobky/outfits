import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixtures = path.join(__dirname, "..", "fixtures");
const photo = path.join(fixtures, "tee-phone.jpg");

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
});

async function open(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name, exact: true }).click();
  return page.getByRole("dialog");
}

async function attach(page: Page, trigger: () => Promise<void>, file = photo) {
  const chooser = page.waitForEvent("filechooser");
  await trigger();
  await (await chooser).setFiles(file);
  await expect(page.getByText("Photo saved").first()).toBeVisible({ timeout: 45_000 });
}

test("add, then delete, a back photo", async ({ page }) => {
  const sheet = await open(page, "Stone chinos");
  await attach(page, () => sheet.getByRole("button", { name: "Back", exact: true }).click());
  await expect(sheet.getByRole("button", { name: "Show Back photo" })).toBeVisible();
  await sheet.getByRole("button", { name: "Delete back" }).click();
  await expect(sheet.getByRole("button", { name: "Show Back photo" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Back", exact: true })).toBeVisible();
});

test("replace the front photo, and add and remove an extra", async ({ page }) => {
  const sheet = await open(page, "Navy linen shorts");
  const front = sheet.locator("img[alt='Navy linen shorts, Front']");
  const before = await front.getAttribute("src");
  await attach(page, () => sheet.getByRole("button", { name: "Replace front" }).click());
  await expect(front).not.toHaveAttribute("src", before ?? "");

  // A different photo: in this memory-only test mode, identical images get identical data URLs.
  await attach(page, () => sheet.getByRole("button", { name: "Photo", exact: true }).click(), path.join(fixtures, "tee-iphone.heic"));
  // Waits on the photo itself: the "Photo saved" toast from the step above may still be showing.
  await expect(sheet.getByRole("button", { name: "Show Photo 1 photo" })).toBeVisible({ timeout: 45_000 });
  await sheet.getByRole("button", { name: "Delete photo 1" }).click();
  await expect(sheet.getByRole("button", { name: "Show Photo 1 photo" })).toHaveCount(0);
});

test("deleting the front photo offers re-upload, which restores it", async ({ page }) => {
  const sheet = await open(page, "Olive cotton cap");
  await sheet.getByRole("button", { name: "Delete front" }).click();
  await expect(sheet.getByText("No front photo yet")).toBeVisible();
  await attach(page, () => sheet.getByRole("button", { name: "Re-upload" }).click());
  await expect(sheet.locator("img[alt='Olive cotton cap, Front']")).toBeVisible();
});

test("a broken image shows the placeholder and recovery actions", async ({ page }) => {
  await page.route("**/demo/belt-brown.svg", (r) => r.abort());
  const sheet = await open(page, "Brown leather belt");
  await expect(sheet.getByText("This photo can't be loaded")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Re-upload" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Delete piece" })).toBeVisible();
});

test("the profile check finds a broken photo and deletes that piece only", async ({ page }) => {
  await page.route("**/demo/boots-black.svg", (r) => r.abort());
  await page.goto("/me");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Black chelsea boots")).toBeVisible();
  await page.getByRole("button", { name: /Delete (this piece|these)/ }).click();
  await expect(page.getByText("Pieces deleted").first()).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Black chelsea boots", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "White leather sneakers", exact: true })).toBeVisible();
});
