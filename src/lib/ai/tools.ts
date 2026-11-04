import { tool, type InferUITools, type UIMessage } from "ai";
import { z } from "zod";
import type { Repo } from "../data/repo";
import { CATEGORIES, COLORS, OCCASIONS, SEASONS, slotFor, type Category } from "../taxonomy";
import type { Item, Profile } from "../types";
import { geocode, getWeather } from "../weather";
import { checkProductUrl } from "./product-page";
import { getSkill, SKILLS } from "./skills";

const categoryEnum = z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]);
const colorEnum = z.enum(Object.keys(COLORS) as [string, ...string[]]);

/** Compact item view for the model — small token footprint, no image URLs. */
function brief(i: Item) {
  return {
    id: i.id,
    name: i.name,
    type: `${i.category}/${i.subcategory}`,
    colors: i.colors,
    pattern: i.pattern,
    material: i.material,
    fit: i.fit,
    formality: i.formality,
    warmth: i.warmth,
    seasons: i.seasons,
    occasions: i.occasions,
    favorite: i.is_favorite || undefined,
    in_laundry: i.in_laundry || undefined,
    worn: i.wear_count,
    last_worn: i.last_worn_at?.slice(0, 10),
  };
}

/** Item view for the UI — what cards and outfit boards render. */
export function visual(i: Item) {
  return { id: i.id, name: i.name, image_url: i.image_url, category: i.category, subcategory: i.subcategory, colors: i.colors, slot: slotFor(i.category) };
}
export type VisualItem = ReturnType<typeof visual>;

export function createTools(repo: Repo, profile: Profile) {
  return {
    load_skill: tool({
      description: "Load a styling skill (expert rules) by name before relying on it.",
      inputSchema: z.object({ name: z.enum(SKILLS.map((s) => s.name) as [string, ...string[]]) }),
      execute: async ({ name }) => ({ name, content: getSkill(name)?.body ?? "Unknown skill" }),
    }),

    get_profile: tool({
      description: "Get the user's full profile (body, sizes, location, preferences).",
      inputSchema: z.object({}),
      execute: async () => repo.getProfile(),
    }),

    update_profile: tool({
      description: "Save facts the user shared about themselves (height, sizes, city, style, colors to avoid…). Only include fields that changed.",
      inputSchema: z.object({
        display_name: z.string().optional(),
        height_cm: z.number().optional(),
        weight_kg: z.number().optional(),
        build: z.string().optional(),
        home_city: z.string().optional(),
        country: z.string().optional(),
        sizes: z.record(z.string(), z.string()).optional(),
        style_keywords: z.array(z.string()).optional(),
        favorite_colors: z.array(z.string()).optional(),
        avoid: z.array(z.string()).optional(),
        budget: z.enum(["low", "mid", "high"]).optional(),
        notes: z.string().optional(),
      }),
      execute: async (patch) => {
        const next: Partial<Profile> = { ...patch, sizes: patch.sizes ? { ...profile.sizes, ...patch.sizes } : undefined };
        if (patch.home_city) {
          const g = await geocode(patch.home_city).catch(() => null);
          if (g) Object.assign(next, { latitude: g.lat, longitude: g.lon, country: patch.country ?? g.country ?? null });
        }
        Object.keys(next).forEach((k) => next[k as keyof Profile] === undefined && delete next[k as keyof Profile]);
        const saved = await repo.updateProfile(next);
        return { saved: Object.keys(next), profile: saved };
      },
    }),

    get_weather: tool({
      description: "Get the forecast for a city and date (defaults: user's home city, today). Supports up to 15 days ahead.",
      inputSchema: z.object({
        city: z.string().optional().describe("City name, e.g. 'Paris'. Omit for the user's home city."),
        date: z.string().optional().describe("YYYY-MM-DD"),
      }),
      execute: async ({ city, date }) => {
        let lat = profile.latitude;
        let lon = profile.longitude;
        let label = profile.home_city ?? "your location";
        if (city) {
          const g = await geocode(city);
          if (!g) return { error: `Couldn't find "${city}"` };
          ({ lat, lon } = g);
          label = [g.name, g.country].filter(Boolean).join(", ");
        }
        if (lat == null || lon == null) return { error: "No location known — ask the user where they are." };
        try {
          return await getWeather({ lat, lon, label, date });
        } catch (e) {
          return { error: (e as Error).message };
        }
      },
    }),

    search_wardrobe: tool({
      description: "Search the user's wardrobe. All filters optional. Returns compact items (ids, attributes). Laundry items are flagged.",
      inputSchema: z.object({
        category: categoryEnum.optional(),
        subcategory: z.string().optional(),
        color: colorEnum.optional(),
        season: z.enum(SEASONS).optional(),
        occasion: z.enum(OCCASIONS).optional(),
        min_formality: z.number().min(1).max(5).optional(),
        max_formality: z.number().min(1).max(5).optional(),
        query: z.string().optional().describe("Free-text, e.g. 'linen' or 'denim jacket'"),
        include_laundry: z.boolean().optional(),
      }),
      execute: async (f) => {
        let items = await repo.listItems({
          category: f.category,
          subcategory: f.subcategory,
          color: f.color,
          season: f.season,
          occasion: f.occasion,
          q: f.query,
          include_laundry: f.include_laundry ?? true,
        });
        if (f.min_formality) items = items.filter((i) => i.formality >= f.min_formality!);
        if (f.max_formality) items = items.filter((i) => i.formality <= f.max_formality!);
        return { count: items.length, items: items.slice(0, 60).map(brief) };
      },
    }),

    wardrobe_stats: tool({
      description: "Summarise the closet: counts by category, subcategory, color, season, formality. Use for gap analysis.",
      inputSchema: z.object({}),
      execute: async () => {
        const items = await repo.listItems({});
        const count = (fn: (i: Item) => string[]) =>
          items.reduce<Record<string, number>>((acc, i) => {
            fn(i).forEach((k) => (acc[k] = (acc[k] ?? 0) + 1));
            return acc;
          }, {});
        return {
          total: items.length,
          in_laundry: items.filter((i) => i.in_laundry).length,
          by_category: count((i) => [i.category]),
          by_subcategory: count((i) => [i.subcategory]),
          by_color: count((i) => i.colors.slice(0, 1)),
          by_season: count((i) => i.seasons),
          by_formality: count((i) => [String(i.formality)]),
        };
      },
    }),

    show_items: tool({
      description: "Display specific wardrobe items to the user as image cards.",
      inputSchema: z.object({ item_ids: z.array(z.string()).min(1).max(12), caption: z.string().optional() }),
      execute: async ({ item_ids, caption }) => {
        const items = await repo.getItems(item_ids);
        return { caption, items: items.map(visual) };
      },
    }),

    compose_outfit: tool({
      description:
        "Render an outfit board from wardrobe item ids. Requires shoes and either top+bottom or a one-piece. The user can save it.",
      inputSchema: z.object({
        name: z.string().describe("Short evocative name"),
        occasion: z.enum(OCCASIONS).optional(),
        item_ids: z.array(z.string()).min(2).max(8),
        why: z.string().describe("1–2 sentences on why it works"),
        swaps: z
          .array(
            z.object({
              replace_item_id: z.string().describe("A piece in this outfit"),
              with_item_id: z.string().describe("A wardrobe piece of the same kind to wear instead"),
              note: z.string().describe("3-6 words on when to pick it, e.g. 'if it rains'"),
            }),
          )
          .max(3)
          .optional()
          .describe("Alternatives from the wardrobe. The user can tap to apply them to the board."),
      }),
      execute: async ({ name, occasion, item_ids, why, swaps }) => {
        const items = await repo.getItems(item_ids);
        const missing = item_ids.filter((id) => !items.some((i) => i.id === id));
        const unavailable = items.filter((i) => i.in_laundry || i.status === "archived").map((i) => i.name);
        const slots = new Set(items.map((i) => slotFor(i.category)));
        const problems = [
          ...(missing.length ? [`unknown ids: ${missing.join(", ")}`] : []),
          ...(unavailable.length ? [`not available (laundry/archived): ${unavailable.join(", ")}`] : []),
          ...(!slots.has("shoes") ? ["no shoes"] : []),
          ...(!slots.has("onepiece") && !(slots.has("top") && slots.has("bottom")) ? ["needs top + bottom"] : []),
        ];
        const options = await repo.getItems((swaps ?? []).map((x) => x.with_item_id));
        const usableSwaps = (swaps ?? []).flatMap((x) => {
          const out = items.find((i) => i.id === x.replace_item_id);
          const inn = options.find((i) => i.id === x.with_item_id);
          const ok = out && inn && !inn.in_laundry && inn.status !== "archived" && slotFor(inn.category) === slotFor(out.category) && !item_ids.includes(inn.id);
          return ok ? [{ replace_id: out.id, replace_name: out.name, with: visual(inn), note: x.note }] : [];
        });
        const order = ["outer", "top", "onepiece", "bottom", "shoes", "accessory"];
        return {
          name,
          occasion: occasion ?? null,
          why,
          swaps: usableSwaps,
          problems,
          items: items.map(visual).sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot)),
        };
      },
    }),

    check_product: tool({
      description: "Read a product link the user shared, to judge whether it works with what they own. Then use search_wardrobe and answer honestly: what it pairs with, whether they already own something too similar, and how many outfits it adds. Saying 'skip it' is a good answer.",
      inputSchema: z.object({ url: z.string().describe("The product link") }),
      execute: async ({ url }) => {
        await repo.track("product_check");
        const check = await checkProductUrl(url);
        const facts = check.status === "ok" ? check.facts : {};
        return {
          url: check.status === "ok" ? check.url : url,
          readable: check.status === "ok",
          title: facts.title ?? null,
          image_url: facts.image_url ?? null,
          price: facts.price ?? null,
          currency: facts.currency ?? null,
          retailer: facts.retailer ?? null,
        };
      },
    }),

    suggest_purchases: tool({
      description:
        "Save shopping suggestions to the user's Shop tab. Only include url/image_url/price if you actually found them (e.g. via web_search). Links are checked: the image and price are read from the retailer's page, and dead links are removed.",
      inputSchema: z.object({
        suggestions: z
          .array(
            z.object({
              title: z.string(),
              category: categoryEnum.optional(),
              subcategory: z.string().optional(),
              color: z.string().optional(),
              brand: z.string().optional(),
              reason: z.string().describe("The gap it fills and what it pairs with"),
              priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
              price: z.number().optional(),
              currency: z.string().optional(),
              url: z.string().url().optional(),
              image_url: z.string().url().optional(),
              retailer: z.string().optional(),
              pairs_with: z.array(z.string()).optional().describe("Wardrobe item ids it works with"),
            }),
          )
          .min(1)
          .max(6),
      }),
      execute: async ({ suggestions: requested }) => {
        const suggestions = await Promise.all(
          requested.map(async (s) => {
            if (!s.url) return s;
            const check = await checkProductUrl(s.url);
            // A dead link takes its details with it, because they described a page that doesn't exist.
            if (check.status === "dead") return { ...s, url: undefined, image_url: undefined, price: undefined, currency: undefined, retailer: undefined };
            if (check.status === "unverified") return s;
            const f = check.facts;
            return { ...s, url: check.url, image_url: f.image_url ?? s.image_url, price: f.price ?? s.price, currency: f.price ? (f.currency ?? s.currency) : s.currency, retailer: f.retailer ?? s.retailer };
          }),
        );
        const created = await repo.createWishlist(
          suggestions.map((s) => ({
            title: s.title,
            category: s.category ?? null,
            subcategory: s.subcategory ?? null,
            color: s.color ?? null,
            brand: s.brand ?? null,
            reason: s.reason,
            priority: s.priority,
            price: s.price ?? null,
            currency: s.currency ?? profile.currency,
            url: s.url ?? null,
            image_url: s.image_url ?? null,
            retailer: s.retailer ?? null,
            pairs_with: s.pairs_with ?? [],
            status: "idea" as const,
            source: "ai" as const,
          })),
        );
        return { saved: created.length, items: created };
      },
    }),

    // Client-side tool: no execute — the UI renders tappable options and
    // answers via addToolOutput, then the chat auto-continues.
    ask_user: tool({
      description: "Ask the user ONE short clarifying question with 2–5 tappable options (they can also type).",
      inputSchema: z.object({ question: z.string(), options: z.array(z.string()).min(2).max(5) }),
      outputSchema: z.object({ answer: z.string() }),
    }),
  };
}

export type DrawerTools = ReturnType<typeof createTools>;
export type DrawerUIMessage = UIMessage<never, never, InferUITools<DrawerTools>>;
