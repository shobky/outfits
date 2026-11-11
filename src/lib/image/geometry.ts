import sharp from "sharp";
import type { Repo } from "../data/repo";

/** Records image geometry only. A photograph without a scale cannot yield cm. */
export async function photoGeometry(repo: Repo, url?: string | null) {
  if (!url) return null;
  try {
    const metadata = await sharp(await repo.readImage(url)).metadata();
    const swap = metadata.orientation === 6 || metadata.orientation === 8;
    const width_px = swap ? metadata.height : metadata.width;
    const height_px = swap ? metadata.width : metadata.height;
    return width_px && height_px ? { width_px, height_px, aspect_ratio: width_px / height_px } : null;
  } catch { return null; }
}
