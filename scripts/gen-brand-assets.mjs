// Deterministic, metadata-free derivatives of the supplied logo. No browser needed.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const icons = new URL("public/icons/", root);
const brand = new URL("public/brand/", root);
await mkdir(icons, { recursive: true });
await mkdir(brand, { recursive: true });
const input = await readFile(new URL("Neon Hanger Shirt App Icon.png", root));
const tile = await sharp(input).rotate().trim({ threshold: 10 }).png().toBuffer();
const square = (size) => sharp(tile).resize(size, size, { fit: "contain", background: "#00000000" });
const png = { palette: true, colours: 256, dither: 0.5, compressionLevel: 9, effort: 10 };
const sizes = [];
async function save(path, data) {
  await writeFile(new URL(path, root), data);
  sizes.push({ path, bytes: data.length });
}
for (const size of [16, 32, 48, 192, 512]) {
  await save(`public/icons/icon-${size}.png`, await square(size).png(png).toBuffer());
}
for (const size of [192, 512]) {
  // Opaque full-bleed background; padded mark stays inside Android's safe circle.
  await save(`public/icons/icon-maskable-${size}.png`, await sharp({ create: { width: size, height: size, channels: 4, background: "#08091c" } })
    .composite([{ input: await square(Math.round(size * 0.9)).toBuffer(), gravity: "centre" }]).removeAlpha().png(png).toBuffer());
}
for (const size of [120, 152, 167, 180]) {
  const name = size === 180 ? "apple-touch-icon.png" : `apple-touch-icon-${size}.png`;
  await save(`public/icons/${name}`, await square(size).flatten({ background: "#08091c" }).png(png).toBuffer());
}
await save("public/brand/logo.webp", await square(256).webp({ quality: 88, effort: 6, alphaQuality: 100 }).toBuffer());
await save("public/brand/logo-512.webp", await square(512).webp({ quality: 90, effort: 6, alphaQuality: 100 }).toBuffer());

// ICO directory with 16/32/48px PNG frames, supported by modern desktop browsers.
const frames = await Promise.all([16, 32, 48].map(async size => ({ size, data: await readFile(new URL(`icon-${size}.png`, icons)) })));
const directory = Buffer.alloc(6 + frames.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(frames.length, 4);
let offset = directory.length;
frames.forEach(({ size, data }, index) => {
  const entry = 6 + index * 16;
  directory[entry] = size;
  directory[entry + 1] = size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(data.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += data.length;
});
await save("src/app/favicon.ico", Buffer.concat([directory, ...frames.map(({ data }) => data)]));

const text = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><g font-family="Arial, sans-serif"><text x="535" y="270" font-size="86" font-weight="700" fill="#f1f2f4">Outfits</text><text x="540" y="338" font-size="34" fill="#c8f05a">Your wardrobe. Your stylist.</text><text x="540" y="391" font-size="26" fill="#a9aabd">Style what you own.</text></g></svg>`);
await save("public/brand/social-card.jpg", await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#08091c" } })
  .composite([{ input: await square(380).toBuffer(), left: 90, top: 125 }, { input: text }]).jpeg({ quality: 85, mozjpeg: true }).toBuffer());
console.table(sizes);
console.log(`Original ${input.length} bytes retained outside public/.`);
