// Generates flat-lay style SVG garments for demo mode → public/demo/*.svg
// Run: node scripts/gen-demo-assets.mjs   (replace with real photos anytime)
import { mkdirSync, writeFileSync } from "node:fs";

const out = new URL("../public/demo/", import.meta.url);
mkdirSync(out, { recursive: true });

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

const svg = (id, c, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
<defs>
<linearGradient id="g${id}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${shade(c, 0.14)}"/><stop offset="1" stop-color="${shade(c, -0.16)}"/></linearGradient>
<pattern id="t${id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="none"/><path d="M0 6L6 0" stroke="${shade(c, -0.3)}" stroke-opacity=".08"/></pattern>
</defs>
${body(`url(#g${id})`, shade(c, -0.28), shade(c, -0.4), `url(#t${id})`)}
</svg>`;

const detail = (d, s, w = 3, o = 0.45) => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round" stroke-linejoin="round"/>`;
const shape = (d, f, s, t) => `<path d="${d}" fill="${f}" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/><path d="${d}" fill="${t}"/>`;

const T = {
  tee: (f, s, s2, t) =>
    shape("M190 112 L250 88 Q300 128 350 88 L410 112 L512 196 L462 262 L412 228 L414 506 Q300 522 186 506 L188 228 L138 262 L88 196 Z", f, s, t) +
    detail("M250 88 Q300 140 350 88", s2, 5) + detail("M138 262 L188 228 M462 262 L412 228", s2, 2.5, 0.3),
  polo: (f, s, s2, t) =>
    T.tee(f, s, s2, t) + shape("M250 88 L300 128 L350 88 L372 120 L318 150 L300 132 L282 150 L228 120 Z", f, s, "none") +
    detail("M300 132 L300 210", s2, 2.5) + `<circle cx="300" cy="160" r="4" fill="${s2}"/><circle cx="300" cy="190" r="4" fill="${s2}"/>`,
  shirt: (f, s, s2, t) =>
    shape("M200 104 L256 82 L300 112 L344 82 L400 104 L468 160 L522 470 L470 482 L418 262 L418 522 L182 522 L182 262 L130 482 L78 470 L132 160 Z", f, s, t) +
    shape("M256 82 L300 112 L280 150 L232 104 Z", f, s, "none") + shape("M344 82 L300 112 L320 150 L368 104 Z", f, s, "none") +
    detail("M300 112 L300 522", s2, 2.5) +
    [170, 240, 310, 380, 450].map((y) => `<circle cx="300" cy="${y}" r="4.5" fill="${s2}" fill-opacity=".7"/>`).join("") +
    detail("M90 440 L132 448 M510 440 L468 448", s2, 3, 0.4),
  sweater: (f, s, s2, t) =>
    shape("M196 108 L252 86 Q300 120 348 86 L404 108 L470 166 L516 456 L470 470 L420 262 L420 506 L180 506 L180 262 L130 470 L84 456 L130 166 Z", f, s, t) +
    detail("M252 86 Q300 134 348 86", s2, 9, 0.35) + detail("M182 488 L418 488", s2, 14, 0.18) +
    detail("M90 452 L130 462 M510 452 L470 462", s2, 10, 0.22) + detail("M220 200 L220 470 M260 200 L260 480 M300 200 L300 480 M340 200 L340 480 M380 200 L380 470", s2, 1.5, 0.12),
  jacket: (f, s, s2, t) =>
    shape("M192 100 L254 78 L300 102 L346 78 L408 100 L474 160 L526 468 L472 482 L424 270 L426 526 L174 526 L176 270 L128 482 L74 468 L126 160 Z", f, s, t) +
    shape("M254 78 L300 102 L276 152 L222 100 Z", f, s, "none") + shape("M346 78 L300 102 L324 152 L378 100 Z", f, s, "none") +
    detail("M300 102 L300 526", s2, 3.5, 0.55) +
    `<rect x="208" y="190" width="68" height="70" rx="6" fill="none" stroke="${s2}" stroke-width="3" stroke-opacity=".5"/><rect x="324" y="190" width="68" height="70" rx="6" fill="none" stroke="${s2}" stroke-width="3" stroke-opacity=".5"/>` +
    detail("M208 212 L276 212 M324 212 L392 212", s2, 3, 0.5) +
    [150, 250, 350, 450].map((y) => `<circle cx="314" cy="${y}" r="6" fill="${s2}" fill-opacity=".8"/>`).join(""),
  coat: (f, s, s2, t) =>
    shape("M196 96 L254 76 L300 140 L346 76 L404 96 L466 156 L512 500 L462 512 L420 280 L428 570 L172 570 L180 280 L138 512 L88 500 L134 156 Z", f, s, t) +
    shape("M254 76 L300 140 L300 300 L238 160 L222 96 Z", shade("#000000", 0) === "#000000" ? f : f, s, "none") +
    shape("M346 76 L300 140 L300 300 L362 160 L378 96 Z", f, s, "none") +
    detail("M300 300 L300 570", s2, 3) + detail("M206 420 L262 420 M338 420 L394 420", s2, 3, 0.4) +
    [330, 400].map((y) => `<circle cx="326" cy="${y}" r="7" fill="${s2}"/><circle cx="274" cy="${y}" r="7" fill="${s2}"/>`).join(""),
  trousers: (f, s, s2, t, wide) =>
    shape(wide ? "M196 66 L404 66 L436 552 L318 556 L300 210 L282 556 L164 552 Z" : "M204 66 L396 66 L416 552 L322 554 L300 206 L278 554 L184 552 Z", f, s, t) +
    `<rect x="${wide ? 196 : 204}" y="66" width="${wide ? 208 : 192}" height="26" fill="${s}" fill-opacity=".25"/>` +
    detail("M300 92 L300 200", s2, 3) + detail(wide ? "M250 92 L246 552 M350 92 L354 552" : "M248 96 L232 548 M352 96 L368 548", s2, 1.6, 0.3) +
    detail("M224 96 Q238 150 268 120 M376 96 Q362 150 332 120", s2, 2.5, 0.4),
  jeans: (f, s, s2, t) =>
    T.trousers(f, s, s2, t) + detail("M206 94 L394 94", "#c9a25a", 2, 0.6) + detail("M300 96 Q292 160 300 200", "#c9a25a", 2, 0.6) +
    detail("M222 98 Q240 160 274 118 M378 98 Q360 160 326 118", "#c9a25a", 2, 0.6),
  shorts: (f, s, s2, t) =>
    shape("M196 150 L404 150 L438 388 L316 398 L300 262 L284 398 L162 388 Z", f, s, t) +
    `<rect x="196" y="150" width="208" height="28" fill="${s}" fill-opacity=".25"/>` + detail("M300 178 L300 256", s2, 3) +
    detail("M300 164 L280 150 M300 164 L320 150", s2, 2) + detail("M170 370 L284 380 M430 370 L316 380", s2, 2, 0.3),
  sneakers: (f, s, s2) =>
    [0, 1].map((i) => {
      const dx = i * 40, dy = i * 70;
      return `<g transform="translate(${dx} ${dy})">
<path d="M70 330 Q72 250 150 236 L240 222 Q300 214 330 250 L420 300 Q520 318 528 360 L528 382 Q300 396 70 382 Z" fill="${f}" stroke="${s}" stroke-width="2.5"/>
<path d="M66 372 L532 372 L530 398 Q300 414 68 402 Z" fill="#d9d9d4" stroke="#b9b9b2" stroke-width="2"/>
${detail("M190 240 L250 300 M215 234 L272 292 M240 228 L294 284", s2, 3, 0.45)}
${detail("M90 340 Q200 330 300 340 Q400 350 520 356", s2, 2, 0.25)}
</g>`;
    }).join(""),
  loafers: (f, s, s2) =>
    [0, 1].map((i) => `<g transform="translate(${i * 36} ${i * 76})">
<path d="M80 340 Q90 270 170 262 L300 258 Q360 256 410 290 Q500 312 520 350 L520 372 Q300 388 78 370 Z" fill="${f}" stroke="${s}" stroke-width="2.5"/>
<path d="M76 366 L522 366 L520 386 Q300 400 78 388 Z" fill="${s2}"/>
${detail("M300 272 Q350 266 392 292", s2, 6, 0.4)}${detail("M330 270 L360 296", s2, 3, 0.4)}
</g>`).join(""),
  boots: (f, s, s2) =>
    [0, 1].map((i) => `<g transform="translate(${i * 150 + 40} ${i * 20})">
<path d="M120 90 L250 90 L254 330 Q330 350 360 400 L362 470 L80 470 L84 420 Q104 380 110 330 Z" fill="${f}" stroke="${s}" stroke-width="2.5"/>
<path d="M80 458 L364 458 L364 490 L80 490 Z" fill="${s2}"/>
<path d="M120 150 Q150 200 120 260 L114 300 L250 300 L254 150 Q220 200 250 150" fill="${s2}" fill-opacity=".35"/>
</g>`).join(""),
  belt: (f, s, s2) =>
    `<g transform="rotate(-18 300 300)"><rect x="40" y="270" width="520" height="56" rx="10" fill="${f}" stroke="${s}" stroke-width="2.5"/>
${detail("M52 282 L548 282 M52 314 L548 314", s2, 1.5, 0.4)}
<rect x="420" y="256" width="86" height="84" rx="12" fill="none" stroke="#b8a271" stroke-width="10"/><rect x="456" y="268" width="8" height="60" fill="#b8a271"/>
${[120, 160, 200, 240].map((x) => `<circle cx="${x}" cy="298" r="6" fill="${s2}"/>`).join("")}</g>`,
  cap: (f, s, s2, t) =>
    shape("M130 330 Q120 160 300 150 Q480 160 470 330 Z", f, s, t) +
    `<path d="M300 330 Q470 320 560 380 Q520 420 420 400 Q350 384 300 360 Z" fill="${f}" stroke="${s}" stroke-width="2.5"/>` +
    detail("M300 152 L300 330 M215 170 Q240 250 228 330 M385 170 Q360 250 372 330", s2, 2, 0.35) + `<circle cx="300" cy="152" r="10" fill="${s2}"/>`,
};

const items = {
  "tee-white": ["tee", "#f4f4f1"],
  "tee-black": ["tee", "#1d1d1f"],
  "oxford-blue": ["shirt", "#a9c6e8"],
  "sweater-cream": ["sweater", "#ebe1cc"],
  "polo-navy": ["polo", "#26324f"],
  "overshirt-grey": ["jacket", "#7d8086"],
  "chore-brown": ["jacket", "#7a5134"],
  "coat-camel": ["coat", "#b98a55"],
  "jeans-indigo": ["jeans", "#2e3d63"],
  "trousers-charcoal": ["trousers-wide", "#3d4046"],
  "chinos-beige": ["trousers", "#cdbb98"],
  "shorts-navy": ["shorts", "#2a3550"],
  "sneakers-white": ["sneakers", "#f5f5f2"],
  "loafers-brown": ["loafers", "#6b4a32"],
  "boots-black": ["boots", "#1f1f21"],
  "belt-brown": ["belt", "#6b4a32"],
  "cap-olive": ["cap", "#6f6b3e"],
};

let i = 0;
for (const [slug, [tpl, color]] of Object.entries(items)) {
  const fn = tpl === "trousers-wide" ? (f, s, s2, t) => T.trousers(f, s, s2, t, true) : T[tpl];
  writeFileSync(new URL(`${slug}.svg`, out), svg(i++, color, fn));
}
console.log(`wrote ${i} garments`);

// App icon (rendered to PNG by scripts/gen-icons.mjs)
const icons = new URL("../public/icons/", import.meta.url);
mkdirSync(icons, { recursive: true });
writeFileSync(
  new URL("icon.svg", icons),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0e1014"/>
<path d="M150 186 L206 162 Q256 196 306 162 L362 186 L420 238 L386 284 L352 262 L352 372 Q256 386 160 372 L160 262 L126 284 L92 238 Z" fill="#c8f05a"/>
<path d="M206 162 Q256 206 306 162" fill="none" stroke="#0e1014" stroke-width="10" stroke-linecap="round"/></svg>`,
);
