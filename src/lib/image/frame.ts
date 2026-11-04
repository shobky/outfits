import sharp from "sharp";

/**
 * Every garment image in the app goes through this, so all of them share one size
 * and identical padding whatever the AI or the camera produced. It's plain code on
 * purpose: consistent framing should never depend on a model following instructions.
 */
export const CANVAS = 1200;
export const PADDING = 0.08;
const ALPHA_THRESHOLD = 12;

interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Share of the image that's see-through, 0–1. */
  clear: number;
}

async function subjectBounds(input: Buffer): Promise<Bounds | null> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1, clear = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else clear++;
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, clear: clear / (info.width * info.height) };
}

/**
 * True when an AI result really is a cut-out. Models sometimes paint a fake
 * checkerboard or a solid backdrop while claiming transparency, or return almost nothing.
 */
export async function isCleanCutout(input: Buffer) {
  const b = await subjectBounds(input);
  return !!b && b.clear >= 0.05 && b.clear <= 0.92;
}

/** Crops to the subject and centres it on a square transparent canvas. */
export async function frameGarment(input: Buffer): Promise<Buffer> {
  const b = await subjectBounds(input);
  if (!b) throw new Error("The image is empty");
  const inner = Math.round(CANVAS * (1 - PADDING * 2));
  const fitted = await sharp(input)
    .ensureAlpha()
    .extract({ left: b.left, top: b.top, width: b.width, height: b.height })
    .resize(inner, inner, { fit: "inside", kernel: "lanczos3" })
    .toBuffer({ resolveWithObject: true });
  const left = Math.floor((CANVAS - fitted.info.width) / 2);
  const top = Math.floor((CANVAS - fitted.info.height) / 2);
  return sharp(fitted.data)
    .extend({ left, right: CANVAS - fitted.info.width - left, top, bottom: CANVAS - fitted.info.height - top, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 95 })
    .toBuffer();
}

/** Applies the camera's orientation plus any correction. Output keeps alpha if there is any. */
export function orient(input: Buffer, opts: { rotation?: number; flip?: boolean } = {}) {
  let img = sharp(input).autoOrient();
  if (opts.rotation) img = sharp(input).autoOrient().rotate(opts.rotation);
  if (opts.flip) img = img.flop();
  return img;
}

export async function uprightJpeg(input: Buffer, rotation = 0, max = 1536) {
  // Rotate first, then resize, because sharp applies rotation after resizing in a single pipeline.
  const turned = await orient(input, { rotation }).png().toBuffer();
  return sharp(turned).resize(max, max, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer();
}
