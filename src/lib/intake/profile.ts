import "server-only";
import { Output, streamText } from "ai";
import sharp from "sharp";
import { z } from "zod";
import type { AIAccess } from "../ai/provider";
import type { TryOnInsights, TryOnPhotoKind } from "../types";

const VISION_MODEL = () => process.env.VISION_MODEL || "gpt-5.4-mini";
const USD_PER_M = { input: 0.75, output: 4.5 };

const insightSchema = z.object({
  shoulders: z.enum(["narrow", "balanced", "broad"]).nullable(),
  torso: z.enum(["short", "balanced", "long"]).nullable(),
  leg_line: z.enum(["short", "balanced", "long"]).nullable(),
  silhouette: z.enum(["slim", "balanced", "broad"]).nullable(),
  posture: z.enum(["relaxed", "upright", "dynamic"]).nullable(),
  fit_notes: z.string().max(500),
  confidence: z.number(),
});

type RawInsights = z.infer<typeof insightSchema>;

const PROMPT = `You help a person prepare a wardrobe try-on reference. Look only at the visible clothing silhouette and pose in the supplied reference photos.

Return broad, qualitative observations that help an image editor preserve this person's proportions. Use null whenever the view is occluded, cropped, low quality or uncertain. Do not identify the person or infer age, gender, ethnicity, skin tone, health, weight, height, body measurements, body mass, attractiveness or any other sensitive trait. Never use numbers. Do not describe their face. Do not make recommendations about changing their body. Keep fit_notes to one short, neutral sentence about preserving garment drape and pose.

The observations are suggestions for the owner to review, not facts. Confidence is 0 to 1.`;

function cleanNotes(value: string) {
  return value
    .replace(/\b\d+(?:\.\d+)?\s*(?:cm|mm|kg|lb|lbs|ft|in|inches)?\b/gi, "")
    .replace(/\b(?:height|weight|skin\s*tone|age|ethnicity|race|gender)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

function sanitize(raw: RawInsights, photos: { url: string; kind: TryOnPhotoKind }[]): TryOnInsights {
  const photoUrls = photos.map((p) => p.url);
  return {
    shoulders: raw.shoulders,
    torso: raw.torso,
    leg_line: raw.leg_line,
    silhouette: raw.silhouette,
    posture: raw.posture,
    fit_notes: cleanNotes(raw.fit_notes) || "Preserve the person's natural pose and the way fabric falls on their body.",
    confidence: Math.min(1, Math.max(0, Number.isFinite(raw.confidence) ? raw.confidence : 0)),
    source_photo_urls: photoUrls,
    generated_at: new Date().toISOString(),
  };
}

async function thumbnail(data: Buffer) {
  return sharp(data).autoOrient().resize(768, 1024, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 78 }).toBuffer();
}

/** Creates a reviewable, qualitative suggestion from the person's own reference photos. */
export async function analyzeTryOnProfile(photos: { url: string; kind: TryOnPhotoKind; data: Buffer }[], ai: Exclude<AIAccess, { source: "none" }>) {
  const prepared = await Promise.all(photos.map(async (photo) => ({ photo, data: await thumbnail(photo.data) })));
  const modelId = await ai.pickModel(VISION_MODEL(), true);
  let streamError: unknown;
  const result = streamText({
    abortSignal: AbortSignal.timeout(100_000),
    model: ai.provider(modelId),
    output: Output.object({ schema: insightSchema }),
    maxRetries: ai.maxRetries,
    providerOptions: { openai: ai.options },
    onError: ({ error }) => {
      streamError = error;
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          ...prepared.flatMap(({ photo, data }, index) => [
            { type: "text" as const, text: `Reference ${index + 1} (${photo.kind}):` },
            { type: "file" as const, mediaType: "image/jpeg", data },
          ]),
        ],
      },
    ],
  });
  const [output, usage] = await Promise.all([result.output, result.usage]).catch((e) => {
    throw streamError ?? e;
  });
  const usd = ai.source === "plan" ? 0 : ((usage.inputTokens ?? 0) * USD_PER_M.input + (usage.outputTokens ?? 0) * USD_PER_M.output) / 1e6;
  return { insights: sanitize(output as RawInsights, photos), usd };
}
