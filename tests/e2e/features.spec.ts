import { expect, test } from "@playwright/test";
import { FEATURES, isFeatureName } from "../../src/lib/features-shared";
import { MAX_REFERENCES, pickReferences } from "../../src/lib/intake/references";
import type { IntakeView } from "../../src/lib/types";

const view = (photo_url: string, v: IntakeView["view"]): IntakeView => ({ photo_url, view: v, rotation: 0, result_url: null, ai: false, error: null });

test.describe("choosing reference photos", () => {
  const front = view("front.jpg", "front");
  const back = view("back.jpg", "back");
  const label = view("label.jpg", "detail");
  const pocket = view("pocket.jpg", "detail");
  const cuff = view("cuff.jpg", "detail");

  test("a piece with one photo has no references, so it costs no more", () => {
    expect(pickReferences([front], front)).toEqual([]);
  });

  test("the photo being styled is never its own reference", () => {
    expect(pickReferences([front, back], front)).toEqual([back]);
    expect(pickReferences([front, view("front.jpg", "detail")], front)).toEqual([]);
  });

  test("close-ups come before the opposite side", () => {
    expect(pickReferences([front, back, label], front)).toEqual([label, back]);
  });

  test("the number sent is capped, however many photos there are", () => {
    const picked = pickReferences([front, back, label, pocket, cuff], front);
    expect(picked).toHaveLength(MAX_REFERENCES);
    expect(picked).toEqual([label, pocket]);
  });
});

test("only known features can be named", () => {
  expect(isFeatureName("multi_photo")).toBe(true);
  expect(isFeatureName("limits_off")).toBe(false);
  expect(isFeatureName("__proto__")).toBe(false);
  expect(isFeatureName(5)).toBe(false);
});

test.describe("developer menu", () => {
  test("a feature starts off, turns on, and stays on after a reload", async ({ page }) => {
    await page.goto("/me");
    const toggle = page.getByRole("switch", { name: FEATURES.multi_photo.label });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  test("an unknown feature is refused", async ({ request }) => {
    const res = await request.post("/api/dev", { data: { feature: "free_money", on: true } });
    expect(res.status()).toBe(400);
  });

  test("saving the profile can't switch a feature on", async ({ request }) => {
    await request.patch("/api/profile", { data: { dev_features: ["multi_photo"] } });
    const usage = await (await request.get("/api/usage")).json();
    expect(usage.features).not.toContain("multi_photo");
  });
});
