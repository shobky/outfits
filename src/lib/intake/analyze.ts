import "server-only";
import { Output, streamText } from "ai";
import sharp from "sharp";
import { z } from "zod";
import type { AIAccess } from "../ai/provider";
import { CATEGORIES, COLORS, FITS, MATERIALS, OCCASIONS, PATTERNS, SEASONS, type Category } from "../taxonomy";

const VISION_MODEL = () => process.env.VISION_MODEL || "gpt-5.4-mini";
/** gpt-5.4-mini per OpenAI's pricing page, 2026-11. Only used to report spend. */
const USD_PER_M = { input: 0.75, output: 4.5 };

const schema = z.object({
  groups: z.array(
    z.object({
      photos: z
        .array(
          z.object({
            index: z.number().int().describe("Photo number, starting at 0"),
            view: z.enum(["front", "back", "detail"]),
            rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).describe("Clockwise degrees that make the garment upright, with collar or waistband at the top"),
          }),
        )
        .min(1),
      name: z.string().describe("Short natural name, e.g. 'Brown leather jacket'"),
      category: z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]),
      subcategory: z.string().describe(`One of: ${Object.values(CATEGORIES).flat().join(", ")}`),
      colors: z.array(z.enum(Object.keys(COLORS) as [string, ...string[]])).min(1).max(3).describe("Dominant first"),
      pattern: z.enum(PATTERNS),
      material: z.enum(MATERIALS).nullable(),
      fit: z.enum(FITS).nullable(),
      seasons: z.array(z.enum(SEASONS)).min(1),
      occasions: z.array(z.enum(OCCASIONS)).min(1),
      formality: z.number().int().describe("1 lounge … 5 formal"),
      warmth: z.number().int().describe("1 very light … 5 very warm"),
      brand: z.string().nullable().describe("Only if a logo or label is clearly readable"),
      description: z.string().describe("One sentence a stylist would use: fabric, cut, details, vibe"),
      facts: z
        .string()
        .describe(
          "Exact visual facts for a photo retoucher who must keep this garment truthful: precise colours and where they vary, surface finish (say if smooth or glossy), every pocket, closure, seam and panel and where it sits, lining colour, label position and any readable text. 2-4 short lines. Only what is visible.",
        ),
      confidence: z.number().describe("0 to 1. How sure you are about this grouping and these details together"),
      question: z.string().nullable().describe("One short question if you need the owner's help, e.g. 'Are these the same jacket?'. Otherwise null"),
    }),
  ),
  rejected: z.array(z.object({ index: z.number().int(), reason: z.string().describe("Short, e.g. 'No clothing visible'") })),
});
export type Analysis = z.infer<typeof schema>;
export type AnalyzedGroup = Analysis["groups"][number];

const PROMPT = `You catalogue clothes for a personal digital wardrobe. Here are one or more photos, numbered from 0, in order.

Decide which photos show the same physical item. Each item becomes one group. Photos of one garment from different sides belong together: the front and back of a jacket are one group, and a close-up of its label is a "detail" of that group. Only group when the colour, material and construction clearly match. Different garments are always separate groups, even if they look alike.

For each photo give its view and the clockwise rotation that makes the garment upright. Photos are often taken sideways: a jacket lying with its collar to the right needs rotation 270, collar to the left needs 90, collar at the bottom needs 180.

Use only the allowed values. Put photos with no clothing, shoes or accessories in "rejected". If two garments share a single photo, describe the most prominent and say so in "question".`;

/** One call for the whole batch, with small images. This is the main cost saver. */
async function thumbnail(input: Buffer) {
  return sharp(input).autoOrient().resize(768, 768, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 72 }).toBuffer();
}

async function callVision<T>(images: { label: string; data: Buffer }[], prompt: string, shape: z.ZodType<T>, ai: Exclude<AIAccess, { source: "none" }>) {
  const modelId = await ai.pickModel(VISION_MODEL(), true);
  let streamError: unknown;
  // Streamed because ChatGPT plan usage refuses anything else.
  const result = streamText({
    model: ai.provider(modelId),
    output: Output.object({ schema: shape }),
    maxRetries: ai.maxRetries,
    providerOptions: { openai: ai.options },
    onError: ({ error }) => {
      streamError = error;
    },

    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...images.flatMap(({ label, data }) => [
            { type: "text" as const, text: label },
            { type: "file" as const, mediaType: "image/jpeg", data },
          ]),
        ],
      },
    ],
  });
  // A failure mid-stream otherwise surfaces only as "could not parse", hiding the real reason.
  const [output, usage] = await Promise.all([result.output, result.usage]).catch((e) => {
    throw streamError ?? e;
  });
  // A plan's usage isn't priced per token, so it costs nothing to report here.
  const usd = ai.source === "plan" ? 0 : ((usage.inputTokens ?? 0) * USD_PER_M.input + (usage.outputTokens ?? 0) * USD_PER_M.output) / 1e6;
  return { output: output as T, usd };
}

export async function analyzePhotos(photos: Buffer[], ai: Exclude<AIAccess, { source: "none" }>): Promise<{ analysis: Analysis; usd: number }> {
  const thumbs = await Promise.all(photos.map(thumbnail));
  const { output, usd } = await callVision(thumbs.map((data, i) => ({ label: `Photo ${i}:`, data })), PROMPT, schema, ai);
  return { analysis: sanitize(output as Analysis, photos.length), usd };
}

const wornSchema = z.object({
  pieces: z.array(
    z.object({
      name: z.string().describe("Short natural name, e.g. 'Blue patterned short-sleeve shirt'"),
      category: z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]),
      subcategory: z.string().describe(`One of: ${Object.values(CATEGORIES).flat().join(", ")}`),
      colors: z.array(z.enum(Object.keys(COLORS) as [string, ...string[]])).min(1).max(3).describe("Dominant first"),
      pattern: z.enum(PATTERNS),
      material: z.enum(MATERIALS).nullable(),
      fit: z.enum(FITS).nullable(),
      seasons: z.array(z.enum(SEASONS)).min(1),
      occasions: z.array(z.enum(OCCASIONS)).min(1),
      formality: z.number().int(),
      warmth: z.number().int(),
      brand: z.string().nullable().describe("Only if a logo or label is clearly readable"),
      description: z.string().describe("One sentence a stylist would use"),
      facts: z.string().describe("Exact visible facts for a retoucher: colours, print, closures, pockets, and what is hidden. Be specific about shoe type. 2-3 short lines."),
      confidence: z.number().describe("0 to 1. How clearly this piece can be seen"),
      match_item_id: z.string().nullable().describe("The id from the wardrobe list if this is clearly that same piece, otherwise null. When unsure, use null"),
    }),
  ),
  question: z.string().nullable().describe("Only if there's something the owner must clear up, e.g. two people are visible"),
});
export type WornAnalysis = z.infer<typeof wornSchema>;

/** Which pieces someone is wearing in one photo, checked against what they already own. */
export async function analyzeWorn(photo: Buffer, closet: { id: string; name: string; type: string; colors: string[] }[], ai: Exclude<AIAccess, { source: "none" }>) {
  const prompt = `This photo shows someone wearing clothes. List each separate piece they're wearing that can be clearly seen: tops, outerwear, bottoms, footwear, and visible accessories such as hats, bags or belts. Skip anything mostly hidden. Ignore the background and anyone else in the frame. Don't describe the person.

Their wardrobe already has these pieces. If a piece is clearly one of them, give its id in match_item_id. Only match when colour, type and details all agree:
${closet.length ? JSON.stringify(closet) : "(empty)"}

Use only the allowed values.`;
  const { output, usd } = await callVision([{ label: "Photo:", data: await thumbnail(photo) }], prompt, wornSchema, ai);
  return { analysis: output as WornAnalysis, usd };
}

/** The model's numbers aren't trusted: each photo lands in exactly one place, and values stay in range. */
export function sanitize(a: Analysis, photoCount: number): Analysis {
  const used = new Set<number>();
  const take = (i: number) => {
    if (!Number.isInteger(i) || i < 0 || i >= photoCount || used.has(i)) return false;
    used.add(i);
    return true;
  };
  const rejected = a.rejected.filter((r) => take(r.index));
  const groups = a.groups.flatMap((g) => {
    const photos = g.photos.filter((p) => take(p.index));
    if (!photos.length) return [];
    if (!photos.some((p) => p.view === "front")) photos[0] = { ...photos[0], view: "front" };
    let seenFront = false, seenBack = false;
    for (const p of photos) {
      if (p.view === "front") {
        if (seenFront) p.view = "detail";
        seenFront = true;
      } else if (p.view === "back") {
        if (seenBack) p.view = "detail";
        seenBack = true;
      }
    }
    const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));
    return [{ ...g, photos, formality: clamp(g.formality), warmth: clamp(g.warmth), confidence: Math.min(1, Math.max(0, g.confidence)) }];
  });
  for (let i = 0; i < photoCount; i++) {
    if (!used.has(i)) rejected.push({ index: i, reason: "We couldn't work out what this photo shows" });
  }
  return { groups, rejected };
}
