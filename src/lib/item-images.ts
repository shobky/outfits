import type { Item, ItemImage } from "./types";

type Photos = Pick<Item, "image_url" | "original_image_url" | "images">;
export type PhotoChange = { patch: Photos; removed: string[] };

function allUrls(p: Photos) {
  return [p.image_url, p.original_image_url, ...p.images.map((i) => i.url)].filter((u): u is string => !!u);
}

/** Files the item referenced before and no longer does. Safe when two fields share one URL. */
function change(before: Photos, patch: Photos): PhotoChange {
  const kept = new Set(allUrls(patch));
  return { patch, removed: [...new Set(allUrls(before))].filter((u) => !kept.has(u)) };
}

export interface SetPhoto {
  view: "front" | "back" | "detail";
  url: string;
  /** Source photo, stored for the front view only. */
  original_url?: string | null;
  /** The extra image this one replaces. Without it a detail photo is added alongside the others. */
  replaces?: string | null;
}

export function setPhoto(item: Photos, { view, url, original_url, replaces }: SetPhoto): PhotoChange {
  if (view === "front") return change(item, { ...item, image_url: url, original_image_url: original_url ?? null });
  const next: ItemImage = { url, view };
  if (view === "back") return change(item, { ...item, images: [...item.images.filter((i) => i.view !== "back"), next] });
  const at = item.images.findIndex((i) => i.url === replaces);
  if (at < 0) return change(item, { ...item, images: [...item.images, next] });
  return change(item, { ...item, images: item.images.map((i, n) => (n === at ? next : i)) });
}

/** Removes one photo. Returns null when the URL isn't on this item, so nothing else can be deleted. */
export function removePhoto(item: Photos, url: string): PhotoChange | null {
  if (item.image_url === url) return change(item, { ...item, image_url: null, original_image_url: null });
  if (!item.images.some((i) => i.url === url)) return null;
  return change(item, { ...item, images: item.images.filter((i) => i.url !== url) });
}

export const photoFiles = allUrls;
