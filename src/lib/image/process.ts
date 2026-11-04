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

export async function removeBg(img: Blob, onProgress?: (pct: number) => void): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");
  return removeBackground(img, {
    model: "isnet_fp16",
    device: "gpu",
    output: { format: "image/png" },
    progress: (key, current, total) => {
      if (key.startsWith("fetch") && total) onProgress?.(Math.round((current / total) * 100));
    },
  });
}

/** Crop to alpha bounds and center on a padded square canvas. */
export async function frame(cutout: Blob): Promise<Blob> {
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
  if (maxX <= minX || maxY <= minY) return cutout; // nothing detected — keep as is
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

export async function processGarment(file: File, onStage: (s: Stage, pct?: number) => void) {
  onStage("preparing");
  const small = await downscale(file);
  onStage("removing");
  let cut: Blob;
  try {
    cut = await removeBg(small, (p) => onStage("removing", p));
  } catch (e) {
    console.warn("Background removal failed, using original", e);
    cut = small;
  }
  onStage("framing");
  const framed = await frame(cut);
  onStage("done");
  return { original: small, cutout: framed };
}
