import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("OS share target keeps photos and links in an explicit review intent", async ({ request, page }) => {
  const response = await request.post("/share/target", {
    maxRedirects: 0,
    multipart: {
      title: "Overshirt from a friend",
      text: "Could this work for dinner?",
      url: "https://example.com/products/overshirt",
      files: { name: "overshirt.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(path.join("tests", "fixtures", "tee-phone.jpg")) },
    },
  });
  expect(response.status()).toBe(303);
  const location = response.headers().location;
  expect(location).toMatch(/\/share\?id=/);
  const id = new URL(location, "http://localhost:3100").searchParams.get("id");
  expect(id).toBeTruthy();
  const intent = await request.get(`/api/share/${id}`);
  expect(intent.ok()).toBeTruthy();
  await expect(intent.json()).resolves.toMatchObject({ title: "Overshirt from a friend", url: "https://example.com/products/overshirt", photos: expect.any(Array) });

  await page.goto(location);
  await expect(page.getByRole("heading", { name: "Shared with Outfits" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Style these photos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save product to wishlist" })).toBeVisible();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await request.get(`/api/share/${id}`)).status()).toBe(404);
});

test("share target refuses non-image files and oversized batches", async ({ request }) => {
  const bad = await request.post("/share/target", { maxRedirects: 0, multipart: { files: { name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") } } });
  expect(bad.status()).toBe(415);
});

test("manual mobile link import reviews and saves an unverified product", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/shop/product", (route) => route.fulfill({ json: { status: "unverified" } }));
  await page.goto("/share");
  await page.getByLabel("Product link (optional)").fill("https://example.com/products/manual-share-test");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Shared with Outfits", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save product to wishlist" }).click();
  await expect(page).toHaveURL(/\/shop$/);
  const saved = (await (await request.get("/api/wishlist")).json()).wishlist.find((item: { url: string }) => item.url === "https://example.com/products/manual-share-test");
  expect(saved).toMatchObject({ status: "saved", price: null, image_url: null });
});

test("private shared photos stay readable after transfer to an intake batch", async ({ page, request }) => {
  const response = await request.post("/share/target", { headers: { accept: "application/json" }, multipart: {
    files: { name: "shirt.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(path.join("tests", "fixtures", "tee-phone.jpg")) },
  } });
  expect(response.ok()).toBe(true);
  const { id, location } = await response.json();
  const intent = await (await request.get(`/api/share/${id}`)).json();
  expect(intent.photos[0]).toMatch(/^\/api\/try-on\/file\/reference\//);
  await page.goto(location);
  await page.getByRole("button", { name: "Add to my drawer" }).click();
  await expect(page).toHaveURL(/\/add$/);
  expect((await request.get(intent.photos[0])).ok()).toBe(true);
  expect((await request.get(`/api/share/${id}`)).status()).toBe(404);
  const intake = await (await request.get("/api/intake")).json();
  expect(intake.batches.some((batch: { photos: string[] }) => batch.photos.includes(intent.photos[0]))).toBe(true);
});
