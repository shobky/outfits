import fs from "node:fs";
import path from "node:path";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { demoRepo } from "../../src/lib/data/demo";

const buffer = fs.readFileSync(path.join(__dirname, "../fixtures/tee-phone.jpg"));
test("missing image credentials produce an actionable configuration error", async ({ request }) => {
  await request.post("/api/dev", { data: { feature: "try_on", on: true } });
  const response = await request.post("/api/try-on", { data: { item_ids: ["example"] } });
  expect(response.status()).toBe(503);
  expect((await response.json()).code).toBe("image_api_not_configured");
});
test("a fitting-room lease admits one caller and only its token can release it", async () => {
  const first = crypto.randomUUID();
  const second = crypto.randomUUID();
  expect(await demoRepo.acquireTryOnLease(first)).toBe(true);
  try {
    expect(await demoRepo.acquireTryOnLease(second)).toBe(false);
    await demoRepo.releaseTryOnLease(second);
    expect(await demoRepo.acquireTryOnLease(second)).toBe(false);
  } finally {
    await demoRepo.releaseTryOnLease(first);
  }
  expect(await demoRepo.acquireTryOnLease(second)).toBe(true);
  await demoRepo.releaseTryOnLease(second);
  expect((await demoRepo.readImage("/demo/tee-white.svg")).length).toBeGreaterThan(0);
  await expect(demoRepo.readImage("/demo/../../.env.local")).rejects.toThrow();
});
async function upload(request: APIRequestContext) {
  const response = await request.post("/api/try-on/upload", { multipart: { file: { name: "reference.jpg", mimeType: "image/jpeg", buffer } } });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).url as string;
}

test("private references upload, persist, replace and delete without deleting other roles", async ({ request }) => {
  await request.post("/api/dev", { data: { feature: "try_on", on: true } });
  await request.delete("/api/try-on/photo");
  const body = await upload(request);
  const face = await upload(request);
  expect(body).toMatch(/^\/api\/try-on\/file\/reference\//);
  for (const [url, kind] of [[body, "full_body"], [face, "face"]]) {
    expect((await request.post("/api/try-on/photo", { data: { url, kind } })).ok()).toBe(true);
    const image = await request.get(url);
    expect(image.ok()).toBe(true);
    expect(image.headers()["cache-control"]).toBe("no-store");
    expect(image.headers()["content-type"]).toContain("image/jpeg");
  }
  const replacement = await upload(request);
  expect((await request.post("/api/try-on/photo", { data: { url: replacement, kind: "full_body" } })).ok()).toBe(true);
  expect((await request.get(body)).status()).toBe(404);
  expect((await request.get(face)).ok()).toBe(true);
  const profile = (await (await request.get("/api/profile")).json()).profile;
  expect(profile.try_on_photo_url).toBe(replacement);
  expect(profile.try_on_photos).toHaveLength(2);
  await request.delete("/api/try-on", { data: { url: face } });
  expect((await request.get(face)).ok()).toBe(true);
  await request.delete("/api/try-on/photo", { data: { kind: "face" } });
  expect((await request.get(face)).status()).toBe(404);
  expect((await request.get(replacement)).ok()).toBe(true);
  await request.delete("/api/try-on/photo");
  expect((await request.get(replacement)).status()).toBe(404);
});

test("invalid files and profile injection are refused", async ({ request }) => {
  await request.post("/api/dev", { data: { feature: "try_on", on: true } });
  const invalid = await request.post("/api/try-on/upload", { multipart: { file: { name: "fake.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") } } });
  expect(invalid.ok()).toBe(false);
  const before = (await (await request.get("/api/profile")).json()).profile;
  await request.patch("/api/profile", { data: { id: "attacker", try_on_photo_url: "https://example.com/photo.jpg", try_on_photos: [{ kind: "face", url: "https://example.com" }], limits_off: true } });
  const after = (await (await request.get("/api/profile")).json()).profile;
  expect(after.id).toBe(before.id);
  expect(after.try_on_photo_url).toBe(before.try_on_photo_url);
  expect(after.try_on_photos).toEqual(before.try_on_photos);
  expect(after.limits_off).toBe(before.limits_off);
});

test("reviewed analysis saves only after user action and expires with replaced photos", async ({ page }) => {
  await page.request.post("/api/dev", { data: { feature: "try_on", on: true } });
  await page.request.delete("/api/try-on/photo");
  await page.goto("/me");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Full body photo, not added" }).click();
  await (await chooser).setFiles({ name: "reference.jpg", mimeType: "image/jpeg", buffer });
  await expect(page.getByRole("button", { name: "Full body photo, saved" })).toBeVisible();
  const profile = (await (await page.request.get("/api/profile")).json()).profile;
  const insights = { shoulders: "balanced", torso: "long", leg_line: null, silhouette: null, posture: "upright", fit_notes: "Preserve natural drape.", confidence: 0.8, source_photo_urls: [profile.try_on_photo_url], generated_at: new Date().toISOString() };
  await page.route("**/api/try-on/profile", async (route) => {
    if (route.request().postDataJSON()?.action === "analyze") return route.fulfill({ json: { insights, saved: false } });
    return route.continue();
  });
  await page.getByRole("button", { name: "Suggest profile details" }).click();
  await expect(page.getByRole("heading", { name: "Review photo suggestions" })).toBeVisible();
  expect((await (await page.request.get("/api/profile")).json()).profile.try_on_insights).toBeNull();
  await page.getByRole("button", { name: "Apply selected" }).click();
  await expect(page.getByText("Profile updated from your review")).toBeVisible();
  expect((await (await page.request.get("/api/profile")).json()).profile.try_on_insights.torso).toBe("long");
  await page.getByRole("button", { name: "Full body photo, saved" }).click();
  await expect(page.getByRole("dialog", { name: "Full body reference" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.request.delete("/api/try-on/photo");
  const { generated_at: ignored, ...reviewed } = insights;
  void ignored;
  expect((await page.request.post("/api/try-on/profile", { data: { action: "save", insights: reviewed } })).status()).toBe(409);
});
