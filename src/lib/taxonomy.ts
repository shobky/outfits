/**
 * Wardrobe taxonomy — the single source of truth for categories and attributes.
 *
 * Loosely modeled on Fashionpedia / DeepFashion2 garment classes and the Google
 * Product Taxonomy apparel tree, simplified for a personal closet. Values are
 * stable string slugs stored in Postgres `text` / `text[]` columns, so adding a
 * value here never needs a migration. See docs/DATA_MODEL.md.
 */

export const CATEGORIES = {
  top: ["t-shirt", "shirt", "polo", "tank", "sweater", "cardigan", "hoodie", "sweatshirt", "blouse", "overshirt"],
  bottom: ["jeans", "trousers", "chinos", "shorts", "joggers", "skirt", "swim-shorts"],
  outerwear: ["jacket", "blazer", "coat", "puffer", "vest", "windbreaker", "leather-jacket", "denim-jacket"],
  onepiece: ["dress", "jumpsuit", "suit"],
  footwear: ["sneakers", "loafers", "boots", "derbies", "sandals", "slides", "trainers"],
  accessory: ["belt", "watch", "cap", "hat", "beanie", "scarf", "bag", "sunglasses", "tie", "jewelry", "socks"],
} as const;

export type Category = keyof typeof CATEGORIES;
export type Subcategory = (typeof CATEGORIES)[Category][number];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: "Tops",
  bottom: "Bottoms",
  outerwear: "Outerwear",
  onepiece: "One-piece",
  footwear: "Shoes",
  accessory: "Accessories",
};

/** Named colors with a reference hex — the AI maps detected colors to these. */
export const COLORS = {
  black: "#111111",
  charcoal: "#3a3d42",
  grey: "#8d9096",
  white: "#f6f6f4",
  cream: "#efe6d2",
  beige: "#d8c7a8",
  camel: "#b98a55",
  brown: "#6b4a32",
  navy: "#1f2a44",
  blue: "#3b6fb6",
  "light-blue": "#a9c6e8",
  green: "#4f7a4a",
  olive: "#6f6b3e",
  red: "#b23a3a",
  burgundy: "#6d2232",
  pink: "#e7a3b5",
  purple: "#6f4f8f",
  yellow: "#e8c547",
  orange: "#d9803a",
} as const;
export type ColorName = keyof typeof COLORS;

export const PATTERNS = ["solid", "striped", "checked", "plaid", "herringbone", "floral", "graphic", "camo", "textured", "other"] as const;
export const MATERIALS = ["cotton", "linen", "wool", "cashmere", "denim", "leather", "suede", "polyester", "nylon", "silk", "knit", "fleece", "corduroy", "canvas", "other"] as const;
export const FITS = ["slim", "regular", "relaxed", "oversized", "wide"] as const;
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export const OCCASIONS = ["casual", "smart-casual", "business", "formal", "sport", "beach", "lounge", "party", "travel", "date"] as const;

export type Pattern = (typeof PATTERNS)[number];
export type Material = (typeof MATERIALS)[number];
export type Fit = (typeof FITS)[number];
export type Season = (typeof SEASONS)[number];
export type Occasion = (typeof OCCASIONS)[number];

/** 1 = loungewear … 5 = black tie */
export const FORMALITY_LABELS = ["", "Lounge", "Casual", "Smart casual", "Business", "Formal"] as const;
/** 1 = very light (linen tee) … 5 = very warm (down parka) */
export const WARMTH_LABELS = ["", "Very light", "Light", "Medium", "Warm", "Very warm"] as const;

/** Where an item sits on the body; used to lay out outfit boards. */
export type Slot = "outer" | "top" | "bottom" | "onepiece" | "shoes" | "accessory";
export function slotFor(category: Category): Slot {
  switch (category) {
    case "outerwear": return "outer";
    case "top": return "top";
    case "bottom": return "bottom";
    case "onepiece": return "onepiece";
    case "footwear": return "shoes";
    default: return "accessory";
  }
}

export const ALL_SUBCATEGORIES = Object.values(CATEGORIES).flat() as Subcategory[];
export function categoryOf(sub: string): Category | undefined {
  return (Object.keys(CATEGORIES) as Category[]).find((c) => (CATEGORIES[c] as readonly string[]).includes(sub));
}
