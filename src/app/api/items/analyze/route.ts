import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getRepo, unauthorized } from "@/lib/data";
import { CATEGORIES, COLORS, FITS, MATERIALS, OCCASIONS, PATTERNS, SEASONS, type Category } from "@/lib/taxonomy";

export const maxDuration = 30;

const schema = z.object({
  name: z.string().describe("Short natural name, e.g. 'Grey wool overshirt'"),
  category: z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]),
  subcategory: z.string().describe(`One of: ${Object.values(CATEGORIES).flat().join(", ")}`),
  colors: z.array(z.enum(Object.keys(COLORS) as [string, ...string[]])).min(1).max(3).describe("Dominant first"),
  pattern: z.enum(PATTERNS),
  material: z.enum(MATERIALS).nullable(),
  fit: z.enum(FITS).nullable(),
  seasons: z.array(z.enum(SEASONS)).min(1),
  occasions: z.array(z.enum(OCCASIONS)).min(1),
  formality: z.number().int().min(1).max(5),
  warmth: z.number().int().min(1).max(5),
  brand: z.string().nullable().describe("Only if a logo/label is clearly visible"),
  description: z.string().describe("One sentence a stylist would use: fabric, cut, details, vibe"),
});
export type Analysis = z.infer<typeof schema>;

/** body: { image: dataURL } — a downscaled JPEG of the cut-out on white. */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { image } = (await req.json()) as { image: string };

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ analysis: null, reason: "OPENAI_API_KEY not set — fill in details manually." });
  }

  const { output } = await generateText({
    model: openai(process.env.VISION_MODEL || "gpt-5.4-mini"),
    output: Output.object({ schema }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "You are cataloguing a garment for a personal digital wardrobe. Identify it precisely. formality: 1 lounge … 5 formal. warmth: 1 very light … 5 very warm. Use only the allowed enum values.",
          },
          { type: "image", image },
        ],
      },
    ],
  });
  return Response.json({ analysis: output });
}
