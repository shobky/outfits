"use client";
/**
 * Garment photo pipeline (runs in the browser, free, private):
 *   1. downscale the phone photo
 *   2. remove background  — @imgly/background-removal (ISNet, ONNX/WASM, WebGPU if available)
 *   3. trim to the garment's alpha bounds, center on a square transparent canvas with padding
 *   4. export WebP (PNG fallback on Safari)
 *
 * Swap step 2 for a server provider (Replicate BiRefNet, remove.bg, Photoroom)
 * behind the same `removeBg()` signature if quality on hard cases (sheer, knit edges)
 * isn't enough. See docs/RESEARCH.md → "Background removal".
 * License note: @imgly/background-removal is AGPL-3.0 — fine for a personal/open project,
 * replace before shipping closed-source commercially.
 */

export type Stage = "preparing" | "removing" | "framing" | "done";

const OUT = 1200; // output square size
const PAD = 0.08; // padding around garment
/** Shared budget for both cut-out attempts. A slow first model download is normal (~100s). */
const CUTOUT_BUDGET_MS = 4 * 60 * 1000;

/** A photo the browser can't read at all. `message` is written for the user. */
export class PhotoReadError extends Error {
  name = "PhotoReadError";
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|tiff?|heic|heif)$/i;
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

/** Windows browsers report an empty MIME type for HEIC, so the extension counts too. */
export function isImageFile(f: File) {
  return f.type.startsWith("image/") || IMAGE_EXT.test(f.name);
}

/** Checks the file's own header, because names and MIME types from phones are unreliable. */
async function isHeic(f: Blob) {
  const head = new Uint8Array(await f.slice(4, 12).arrayBuffer());
  const text = String.fromCharCode(...head);
  return text.startsWith("ftyp") && HEIC_BRANDS.has(text.slice(4));
}

/** Returns a blob this browser can decode, converting HEIC where there's no native support. */
async function toDecodable(file: File): Promise<Blob> {
  try {
    (await toBitmap(file)).close();
    return file;
  } catch (decodeError) {
    if (!(await isHeic(file))) {
      console.error("Photo decode failed", file.name, file.type, decodeError);
      throw new PhotoReadError(`We couldn't read "${file.name}". It may be damaged, or a format this browser doesn't support. Try a JPEG or PNG.`);
    }
  }
  try {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    return Array.isArray(out) ? out[0] : out;
  } catch (e) {
    console.error("HEIC conversion failed", file.name, e);
    throw new PhotoReadError(`We couldn't convert the iPhone photo "${file.name}". Try exporting it as a JPEG.`);
  }
}

async function toBitmap(src: Blob): Promise<ImageBitmap> {
  return createImageBitmap(src, { imageOrientation: "from-image" } as ImageBitmapOptions);
}

async function canvasToBlob(c: HTMLCanvasElement | OffscreenCanvas, type: string, quality?: number): Promise<Blob> {
  if ("convertToBlob" in c) return c.convertToBlob({ type, quality });
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), type, quality));
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export async function downscale(file: Blob, max = 1600): Promise<Blob> {
  const bmp = await toBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = canvas(Math.round(bmp.width * s), Math.round(bmp.height * s));
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return canvasToBlob(c, "image/jpeg", 0.92);
}

function before<T>(work: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error("Background removal timed out")), Math.max(0, deadline - Date.now()));
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Tries WebGPU, then WASM. Throws when both fail or the time budget runs out. */
export async function removeBg(img: Blob, onProgress?: (pct: number) => void): Promise<Blob> {
  const deadline = Date.now() + CUTOUT_BUDGET_MS;
  const { removeBackground } = await import("@imgly/background-removal");
  const attempt = (device: "gpu" | "cpu") =>
    removeBackground(img, {
      model: "isnet_fp16",
      device,
      output: { format: "image/png" },
      progress: (key, current, total) => {
        if (key.startsWith("fetch") && total) onProgress?.(Math.round((current / total) * 100));
      },
    });
  try {
    return await before(attempt("gpu"), deadline);
  } catch (e) {
    if (Date.now() >= deadline) throw e;
    console.warn("WebGPU cut-out failed, retrying on CPU", e);
    return before(attempt("cpu"), deadline);
  }
}

/** Crop to alpha bounds and center on a padded square canvas. Null when the image is fully transparent. */
export async function frame(cutout: Blob): Promise<Blob | null> {
  const bmp = await toBitmap(cutout);
  const src = canvas(bmp.width, bmp.height);
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(bmp, 0, 0);
  const { data, width, height } = sctx.getImageData(0, 0, src.width, src.height);
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return null;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const inner = OUT * (1 - PAD * 2);
  const s = Math.min(inner / bw, inner / bh);
  const dw = bw * s;
  const dh = bh * s;
  const out = canvas(OUT, OUT);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, minX, minY, bw, bh, (OUT - dw) / 2, (OUT - dh) / 2, dw, dh);
  const webp = await canvasToBlob(out, "image/webp", 0.9);
  return webp.type === "image/webp" ? webp : canvasToBlob(out, "image/png");
}

/** Small JPEG on white for the vision model (cheap tokens, no alpha confusion). */
export async function toAnalysisDataUrl(img: Blob, size = 640): Promise<string> {
  const bmp = await toBitmap(img);
  const s = Math.min(1, size / Math.max(bmp.width, bmp.height));
  const c = canvas(Math.round(bmp.width * s), Math.round(bmp.height * s));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

/** Decoded and downscaled, with no cut-out. For detail shots where the background doesn't matter. */
export async function preparePhoto(file: File): Promise<Blob> {
  return downscale(await toDecodable(file));
}

export interface ProcessedGarment {
  original: Blob;
  cutout: Blob;
  /** Set when the background couldn't be removed and `cutout` is the framed original. */
  cutoutProblem: string | null;
}

/**
 * Throws PhotoReadError only if the photo can't be decoded. Every later failure
 * falls back to the original, so the piece can always be saved.
 * `onOriginal` fires as soon as a usable image exists, before the slow cut-out.
 */
export async function processGarment(
  file: File,
  onStage: (s: Stage, pct?: number) => void,
  onOriginal?: (original: Blob) => void,
): Promise<ProcessedGarment> {
  onStage("preparing");
  const small = await downscale(await toDecodable(file));
  onOriginal?.(small);
  onStage("removing");
  let cutoutProblem: string | null = null;
  let cut = small;
  try {
    cut = await removeBg(small, (p) => onStage("removing", p));
  } catch (e) {
    console.warn("Background removal failed, using original", e);
    cutoutProblem = "We couldn't remove the background, so this piece will use your original photo.";
  }
  onStage("framing");
  let framed = await frame(cut);
  if (!framed) {
    cutoutProblem = "No garment was found in the cut-out, so this piece will use your original photo.";
    framed = (await frame(small)) ?? small;
  }
  onStage("done");
  return { original: small, cutout: framed, cutoutProblem };
}
