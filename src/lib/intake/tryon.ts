import "server-only";
import sharp from "sharp";
import { callImageEdit } from "./studio";

const PROMPT = `The first image is a photo of a person. The other images are clothes they own. Show this same person wearing these exact clothes, instead of what they have on.
Keep their face, hair, skin tone, body shape, pose, framing and the background unchanged. Don't make them slimmer, taller or more styled.
Keep each garment's real colour, material, pattern and details, fitted naturally to their body with realistic folds and shadows.
The result must look like an ordinary real photo of them. No text, and no extra people.`;

/** A person dressed in up to 4 pieces. The result is a preview, not a record of how anything fits. */
export async function renderTryOn(person: Buffer, garments: Buffer[]) {
  const [personJpeg, ...clothes] = await Promise.all([
    sharp(person).autoOrient().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer(),
    ...garments.map((g) => sharp(g).resize(768, 768, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer()),
  ]);
  return callImageEdit({ prompt: PROMPT, images: [personJpeg, ...clothes], size: "1024x1536", background: "opaque", format: "jpeg" });
}
