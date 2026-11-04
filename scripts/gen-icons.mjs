// Renders public/icons/icon.svg → PNGs for the PWA manifest using the preinstalled Playwright Chromium.
// Run: node scripts/gen-icons.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const svg = readFileSync(new URL("../public/icons/icon.svg", import.meta.url), "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [
  ["icon-192.png", 192, 0],
  ["icon-512.png", 512, 0],
  ["apple-touch-icon.png", 180, 0],
  ["icon-maskable-512.png", 512, 0.1],
]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(
    `<body style="margin:0;background:${pad ? "#0e1014" : "transparent"};display:grid;place-items:center;height:100vh">
     <div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body>`,
  );
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname, omitBackground: !pad });
}
await browser.close();
console.log("icons written");
