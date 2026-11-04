import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { CANVAS, frameGarment, isCleanCutout, PADDING, uprightJpeg } from "../../src/lib/image/frame";

/** A coloured rectangle on transparency, standing in for a garment. */
const cutout = (w: number, h: number, canvasW = 1024, canvasH = 1024, left = 10, top = 10) =>
  sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: w, height: h, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } } }, left, top }])
    .png()
    .toBuffer();

async function subject(input: Buffer) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let l = info.width, t = info.height, r = -1, b = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 12) {
      if (x < l) l = x;
      if (x > r) r = x;
      if (y < t) t = y;
      if (y > b) b = y;
    }
  }
  return { width: info.width, height: info.height, left: l, right: info.width - 1 - r, top: t, bottom: info.height - 1 - b };
}

test("every garment gets the same canvas and padding, wherever the AI put it", async () => {
  const pad = Math.round(CANVAS * PADDING);
  for (const source of [await cutout(900, 300, 1024, 1024, 5, 700), await cutout(200, 950, 1024, 1024, 800, 20), await cutout(500, 500)]) {
    const s = await subject(await frameGarment(source));
    expect([s.width, s.height]).toEqual([CANVAS, CANVAS]);
    // The longest side touches the padding; the other side is centred.
    expect(Math.min(s.left, s.top)).toBeGreaterThanOrEqual(pad - 2);
    expect(Math.min(s.left, s.top)).toBeLessThanOrEqual(pad + 2);
    expect(Math.abs(s.left - s.right)).toBeLessThanOrEqual(2);
    expect(Math.abs(s.top - s.bottom)).toBeLessThanOrEqual(2);
  }
});

test("a photo isn't stretched: its proportions survive framing", async () => {
  const s = await subject(await frameGarment(await cutout(600, 300)));
  const width = CANVAS - s.left - s.right;
  const height = CANVAS - s.top - s.bottom;
  expect(width / height).toBeCloseTo(2, 1);
});

test("rotation turns a sideways photo upright", async () => {
  const wide = await sharp({ create: { width: 400, height: 100, channels: 3, background: "#123456" } }).jpeg().toBuffer();
  const out = await sharp(await uprightJpeg(wide, 90)).metadata();
  expect([out.width, out.height]).toEqual([100, 400]);
});

test("fake transparency is caught: solid backgrounds and empty results aren't cut-outs", async () => {
  const solid = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#ffffff" } }).png().toBuffer();
  const empty = await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  expect(await isCleanCutout(solid)).toBe(false);
  expect(await isCleanCutout(empty)).toBe(false);
  expect(await isCleanCutout(await cutout(500, 500))).toBe(true);
});
