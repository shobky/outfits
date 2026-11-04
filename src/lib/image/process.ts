"use client";
/**
 * Prepares a phone photo for upload: reads any format, applies the camera's orientation,
 * and shrinks it. Everything else (cut-out, styling, framing) happens on the server, so
 * it survives the app being closed and doesn't depend on the phone's memory.
 */

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.8;

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

function toBitmap(src: Blob) {
  return createImageBitmap(src, { imageOrientation: "from-image" } as ImageBitmapOptions);
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

/** A JPEG small enough to upload quickly and sharp enough for the AI. */
export async function preparePhoto(file: File): Promise<Blob> {
  const bmp = await toBitmap(await toDecodable(file));
  const s = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new PhotoReadError("We couldn't prepare that photo"))), "image/jpeg", JPEG_QUALITY));
}
