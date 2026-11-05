import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { cropAround, MAX_WORN_PIECES, sortWornPieces } from "../../src/lib/intake/worn-rules";

const photo = path.join(__dirname, "..", "fixtures", "tee-phone.jpg");

async function setFeature(page: Page, feature: string, on: boolean) {
  const r = await page.request.post("/api/dev", { data: { feature, on } });
  expect(r.ok()).toBe(true);
}

test.describe("worn photo rules", () => {
  const closet = new Set(["real-id"]);
  const piece = (name: string, confidence: number, match_item_id: string | null = null) => ({ name, confidence, match_item_id });

  test("a piece already owned is matched, not generated again", () => {
    const { matched, fresh } = sortWornPieces([piece("shirt", 0.9, "real-id"), piece("shorts", 0.8)], closet);
    expect(matched.map((p) => p.name)).toEqual(["shirt"]);
    expect(fresh.map((p) => p.name)).toEqual(["shorts"]);
  });

  test("a made-up match can't hide a new piece", () => {
    const { matched, fresh } = sortWornPieces([piece("hat", 0.9, "invented-id")], closet);
    expect(matched).toEqual([]);
    expect(fresh[0].match_item_id).toBeNull();
  });

  test("cost is capped: only the clearest pieces are made", () => {
    const many = Array.from({ length: 9 }, (_, i) => piece(`p${i}`, i / 10));
    const { fresh } = sortWornPieces(many, closet);
    expect(fresh).toHaveLength(MAX_WORN_PIECES);
    expect(fresh[0].name).toBe("p8");
  });

  test("the crop box stays inside the photo wherever you tap", () => {
    for (const tap of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 0.5 }, { x: 0.02, y: 0.98 }]) {
      for (const aspect of [0.5, 0.75, 1, 1.78]) {
        const b = cropAround(tap, 0.85, aspect);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(1.0001);
        expect(b.y + b.height).toBeLessThanOrEqual(1.0001);
      }
    }
  });
});

test.describe("items from worn photos", () => {
  test("off: no button, and the server refuses even a direct request", async ({ page }) => {
    await setFeature(page, "worn_extract", false);
    await page.goto("/add");
    await expect(page.getByRole("button", { name: "Choose photos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "From a photo of me" })).toHaveCount(0);
    const res = await page.request.post("/api/intake", { data: { photos: ["x"], kind: "worn" } });
    expect(res.status()).toBe(403);
  });

  test("on: only the chosen area leaves the device", async ({ page }) => {
    await setFeature(page, "worn_extract", true);
    await page.goto("/add");
    const uploads: number[] = [];
    await page.route("**/api/upload", async (r) => {
      uploads.push(r.request().postDataBuffer()?.length ?? 0);
      await r.fulfill({ json: { url: "/api/files/00000000-0000-0000-0000-000000000000.jpg" } });
    });
    let sent: { kind?: string } | null = null;
    await page.route("**/api/intake", async (r) => {
      if (r.request().method() !== "POST") return r.continue();
      sent = r.request().postDataJSON();
      await r.fulfill({ status: 400, json: { error: "stopped by the test" } });
    });
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "From a photo of me" }).click();
    await (await chooser).setFiles(photo);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Which one is you?" })).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole("button", { name: "Use this area" })).toBeDisabled();
    const area = dialog.getByTestId("worn-area");
    await area.click({ position: { x: 40, y: 40 } });
    await expect(dialog.getByTestId("worn-box")).toBeVisible();
    await dialog.getByLabel("Size of the area").fill("0.4");
    await dialog.getByRole("button", { name: "Use this area" }).click();
    await expect.poll(() => sent).not.toBeNull();
    expect(sent!.kind).toBe("worn");
    expect(uploads).toHaveLength(1);
  });

  test("without the API key it says so rather than failing later", async ({ page }) => {
    await setFeature(page, "worn_extract", true);
    const res = await page.request.post("/api/intake", { data: { photos: ["x"], kind: "worn" } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain("isn't available");
  });
});

test.describe("try-on", () => {
  test("off: no button, and the server refuses", async ({ page }) => {
    await setFeature(page, "try_on", false);
    await page.goto("/outfits");
    await expect(page.getByRole("button", { name: "Delete outfit" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Try it on" })).toHaveCount(0);
    expect((await page.request.post("/api/try-on", { data: { item_ids: ["a"] } })).status()).toBe(403);
  });

  test("on: asks for a photo first, then shows a clearly labelled preview", async ({ page }) => {
    await setFeature(page, "try_on", true);
    await page.goto("/outfits");
    await page.getByRole("button", { name: "Try it on" }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Add a photo of yourself")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "See it on me" })).toHaveCount(0);

    const chooser = page.waitForEvent("filechooser");
    await sheet.getByRole("button", { name: "Choose a photo" }).click();
    await (await chooser).setFiles(photo);
    await expect(sheet.getByRole("button", { name: "See it on me" })).toBeVisible({ timeout: 20_000 });

    // The real call needs the API key, so the answer is stubbed.
    await page.route("**/api/try-on", (r) => (r.request().method() === "POST" ? r.fulfill({ json: { url: "/demo/tee-white.svg" } }) : r.fulfill({ json: { ok: true } })));
    await sheet.getByRole("button", { name: "See it on me" }).click();
    await expect(sheet.getByText("AI preview, not a real photo")).toBeVisible();

    await page.unroute("**/api/try-on");
    page.on("dialog", (d) => d.accept());
    await sheet.getByRole("button", { name: "Remove photo" }).click();
    await expect(sheet.getByText("Add a photo of yourself")).toBeVisible();
  });

  test("a photo that isn't yours is refused", async ({ request }) => {
    const res = await request.post("/api/try-on/photo", { data: { url: "https://example.com/someone.jpg" } });
    expect(res.status()).toBe(400);
  });
});

test.describe("dashboard", () => {
  test("shows spend, people and invites, and manages both", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Spend" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
    await page.getByLabel("Invite code").fill("friend-sara");
    await page.getByLabel("Who it's for").fill("Sara");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("FRIEND-SARA")).toBeVisible();
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Revoke FRIEND-SARA" }).click();
    await expect(page.getByText("FRIEND-SARA")).toHaveCount(0);
  });

  test("a bad code or feature is refused", async ({ request }) => {
    expect((await request.post("/api/admin", { data: { action: "create_invite", code: "a b" } })).status()).toBe(400);
    expect((await request.post("/api/admin", { data: { action: "set_features", user_id: "x", features: ["free_money"] } })).status()).toBe(400);
  });

  test("non-owners see a plain message, not the data", async ({ page }) => {
    await page.route("**/api/admin", (r) => r.fulfill({ status: 403, json: { error: "Not allowed" } }));
    await page.goto("/admin");
    await expect(page.getByRole("alert").filter({ hasText: "for the app's owner" })).toBeVisible({ timeout: 15_000 });
  });
});
