import type { Item, ItemFilters } from "../types";

/** Shared in-memory filter so demo + Supabase repos behave identically. */
export function filterItems(items: Item[], f: ItemFilters = {}): Item[] {
  const q = f.q?.trim().toLowerCase();
  return items.filter((it) => {
    const status = f.status ?? "active";
    if (status !== "all" && it.status !== status) return false;
    if (f.include_laundry === false && it.in_laundry) return false;
    if (f.category && it.category !== f.category) return false;
    if (f.subcategory && it.subcategory !== f.subcategory) return false;
    if (f.color && !it.colors.includes(f.color as Item["colors"][number])) return false;
    if (f.season && !it.seasons.includes(f.season)) return false;
    if (f.occasion && !it.occasions.includes(f.occasion)) return false;
    if (f.favorite && !it.is_favorite) return false;
    if (q) {
      const hay = [it.name, it.subcategory, it.brand, it.material, it.description, ...it.colors, ...it.occasions]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}
