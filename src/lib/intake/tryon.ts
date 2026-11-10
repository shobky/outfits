import "server-only";
import sharp from "sharp";
import { callImageEdit } from "./studio";

function prompt(identityCount: number, garmentCount: number, fitNotes?: string) {
  const identity = identityCount ? ` Images 2-${identityCount + 1} are additional reference photos of the same person; use them only to preserve their face, hair and proportions.` : "";
  const garmentStart = identityCount + 2;
  const garments = garmentCount ? ` Images ${garmentStart}-${garmentStart + garmentCount - 1} are the exact garments to put on them.` : "";
  return `Image 1 is a photo of a person.${identity}${garments} Show this same person wearing these exact clothes, instead of what they have on.
Keep their face, hair, skin tone, body shape, pose, framing and the background unchanged. Do not make them slimmer, taller, shorter, younger, older or more styled. Preserve the natural proportions seen in the reference photos.
Keep each garment's real colour, material, pattern and details, fitted naturally to their body with realistic folds, tension and shadows. Respect the saved fit context if present: ${fitNotes || "use the reference photos and the person's natural proportions"}.
The result must look like an ordinary real photo of them, with no generated face, body reshaping, text, watermark or extra people.`;
}

/** A person dressed in up to 4 pieces. The result is a preview, not a record of how anything fits. */
export async function renderTryOn(person: Buffer, garments: Buffer[], opts?: { identity?: Buffer[]; fitNotes?: string }) {
  const identity = opts?.identity ?? [];
  const [personJpeg, ...referencesAndClothes] = await Promise.all([
    sharp(person).autoOrient().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer(),
    ...identity.map((photo) => sharp(photo).autoOrient().resize(1024, 1280, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 84 }).toBuffer()),
    ...garments.map((g) => sharp(g).resize(768, 768, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer()),
  ]);
  return callImageEdit({ prompt: prompt(identity.length, garments.length, opts?.fitNotes), images: [personJpeg, ...referencesAndClothes], size: "1024x1536", background: "opaque", format: "jpeg" });
}
