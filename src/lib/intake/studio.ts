import "server-only";
import { resolveAI } from "../ai/provider";
import { frameGarment, isCleanCutout, uprightJpeg } from "../image/frame";

/**
 * Turns a phone photo into a consistent studio shot. Chosen by testing on real
 * garments (docs/RESEARCH.md): 2.5 Sunburst was the most faithful of the models that
 * return real transparency, once the photo was upright and the prompt carried facts.
 */
const IMAGE_MODEL = () => process.env.IMAGE_MODEL || "gpt-image-2.5-sunburst";
/** $ per million tokens for GPT Image 2.5 models, per OpenAI's docs, 2026-11. */
const USD_PER_M = { text: 5, image: 8, output: 30 };
const TIMEOUT_MS = 150_000;

function prompt(facts: string, view: string, references: number) {
  const extra = references
    ? `\nThe first image is the photo to edit. The other ${references === 1 ? "image is another photo" : `${references} images are other photos`} of this same garment, from other angles or close up. Use them only to get its colour, texture and details right. Show the ${view === "back" ? "back" : "front"} as seen in the first image.`
    : "";
  return `Edit this photo into a professional e-commerce product photo of the EXACT same garment, showing its ${view === "back" ? "back" : "front"}. Stay as close to the source photo as possible: this is a retouch, not a redesign.
${extra}
Facts about this exact item, which must stay true:
${facts}
Keep the real colour, material, texture, pattern, hardware and proportions. Do not add, remove or redesign anything. Keep any label text as it appears, or leave it unreadable rather than inventing letters.
The garment must be upright and facing the camera. Arrange it neatly with natural shape and soft even studio lighting.
Centre it and make it fill about 80% of the square, with equal space on all sides and nothing cropped.
Background must be fully transparent. No person, hanger, surface, props, text or cast shadow.`;
}

function wornPrompt(name: string, category: string, facts: string) {
  const display = category === "footwear" ? "Show them as a neat pair, side by side, angled slightly." : category === "bottom" ? "Lay them out straight, front facing, as a flat lay." : category === "accessory" ? "Show it on its own, centred, front facing." : "Show it hanging straight, front facing, with natural shape, as if on an invisible mannequin.";
  return `The photo shows a person wearing clothes. Make a professional e-commerce product photo of ONLY this piece: ${name}.
Facts about this exact item, which must stay true:
${facts}
Remove the person completely: no face, skin, hands, hair or body. Remove every other garment, even where it touches or overlaps this one, and don't treat another garment as part of this one.
Keep its real colour, material, print and details from the photo. Where it's hidden, complete it plainly and conservatively. Don't invent logos, text or decoration.
${display} Soft even studio lighting. Centre it and make it fill about 80% of the square, with equal space on all sides and nothing cropped.
Background must be fully transparent. No hanger, surface, props, text or cast shadow.`;
}

/** Studio shots need the API key: ChatGPT plan usage has no image generation, and plan users mustn't spend the key. */
export const studioEnabled = (owner: string) => resolveAI(owner).source === "key";

export async function callImageEdit(opts: { prompt: string; images: Buffer[]; size: "1024x1024" | "1024x1536"; background: "transparent" | "opaque"; format: "png" | "jpeg" }) {
  const form = new FormData();
  form.append("model", IMAGE_MODEL());
  form.append("prompt", opts.prompt);
  // Order matters: the prompts describe the images by position.
  opts.images.forEach((b, i) => form.append("image[]", new Blob([new Uint8Array(b)], { type: "image/jpeg" }), `image-${i + 1}.jpg`));
  form.append("size", opts.size);
  form.append("quality", "medium");
  form.append("output_format", opts.format);
  form.append("background", opts.background);
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: { b64_json?: string }[];
    usage?: { output_tokens?: number; input_tokens_details?: { text_tokens?: number; image_tokens?: number } };
    error?: { message?: string };
  };
  if (!res.ok || !body.data?.[0]?.b64_json) {
    const err = new Error(body.error?.message ?? `The image service returned ${res.status}`) as Error & { retryable?: boolean };
    err.retryable = res.status === 429 || res.status >= 500;
    throw err;
  }
  const d = body.usage?.input_tokens_details;
  const usd = ((d?.text_tokens ?? 0) * USD_PER_M.text + (d?.image_tokens ?? 0) * USD_PER_M.image + (body.usage?.output_tokens ?? 0) * USD_PER_M.output) / 1e6;
  return { image: Buffer.from(body.data[0].b64_json, "base64"), usd };
}

const ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Network drops and overload pass on their own. A refused request won't, so it isn't repeated. */
function isTransient(e: unknown) {
  const err = e as Error & { retryable?: boolean };
  return !!err.retryable || err.name === "TimeoutError" || err instanceof TypeError;
}

function explain(e: unknown) {
  if (e instanceof TypeError) return "We couldn't reach the AI service";
  if ((e as Error).name === "TimeoutError") return "The AI service took too long";
  return (e as Error).message;
}

/** Returns a framed WebP ready to store. Throws with a reason the owner can read. */
export async function restyle(photo: Buffer, opts: { rotation: number; facts: string; view: string; references?: { photo: Buffer; rotation: number }[]; worn?: { name: string; category: string } }) {
  const upright = await uprightJpeg(photo, opts.rotation);
  // References are smaller: they only need to show detail, and input images are billed by size.
  const references = await Promise.all((opts.references ?? []).map((r) => uprightJpeg(r.photo, r.rotation, 1024)));
  let usd = 0;
  let last: unknown = new Error("The result didn't come back as a clean cut-out");
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt) await sleep(2000 * attempt);
    try {
      const { image, usd: cost } = await callImageEdit({
        prompt: opts.worn ? wornPrompt(opts.worn.name, opts.worn.category, opts.facts) : prompt(opts.facts, opts.view, references.length),
        images: [upright, ...references],
        size: "1024x1024",
        background: "transparent",
        format: "png",
      });
      usd += cost;
      if (await isCleanCutout(image)) return { data: await frameGarment(image), usd };
      last = new Error("The result didn't come back as a clean cut-out");
      // A bad result was paid for, so try it once more, not twice.
      if (attempt >= 1) break;
    } catch (e) {
      console.warn(`[studio] attempt ${attempt + 1} failed`, e);
      last = e;
      if (!isTransient(e)) break;
    }
  }
  throw Object.assign(new Error(explain(last)), { usd });
}

/** The real photo, upright and framed. Used when AI is off or fails, and for "use my photo". */
export async function frameOriginal(photo: Buffer, rotation = 0) {
  return frameGarment(await uprightJpeg(photo, rotation, 1600));
}
