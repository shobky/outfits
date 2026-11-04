/**
 * Stylist skills — curated styling knowledge the agent loads on demand via the
 * `load_skill` tool (progressive disclosure: only the index lives in the system
 * prompt). Edit these to improve taste. Keep each skill tight and opinionated;
 * see docs/STYLIST.md for how to add / evaluate skills.
 */

export interface Skill {
  name: string;
  description: string; // shown to the model in the index — say WHEN to load it
  body: string;
}

export const SKILLS: Skill[] = [
  {
    name: "outfit-composition",
    description: "ALWAYS load before composing an outfit. Structural rules, texture/leather matching, rotation.",
    body: `
# Outfit composition
Structure (required):
- 1 top + 1 bottom, OR 1 one-piece. Shoes are mandatory. Outerwear when temp < 18°C, rain, or the dress code needs a jacket.
- 0–2 accessories. A belt only with tucked tops or trousers with belt loops on show.
- Max 1 statement piece (bold color, loud pattern, unusual cut). Everything else supports it.

Cohesion:
- Formality: every piece within ±1 of the target formality. Shoes set the ceiling — sneakers cap a look around smart-casual.
- Leathers: belt and shoes in the same color family (brown with brown, black with black). Watch strap ideally too.
- Texture: mix at least two textures (e.g. knit + denim, wool + suede). Avoid all-flat or all-shiny.
- Pattern: one pattern per look unless scales differ strongly (fine stripe + large check). Solids are always safe.
- Weight: match fabric weights — no linen shorts under a wool overcoat.

Rotation & availability:
- Never use items with in_laundry=true or status=archived.
- Prefer pieces not worn recently (low wear_count / old last_worn_at) unless the user asks for favorites.
- If the wardrobe can't make a complete outfit, say exactly what's missing and offer a shopping suggestion.

Presentation:
- Give the outfit a short evocative name ("Sunday coffee", "Lisbon dinner").
- Explain in 1–3 crisp lines WHY it works (color, proportion, occasion, weather). No essays.
- Offer one swap ("swap the loafers for white sneakers if you'll walk a lot").`,
  },
  {
    name: "color-harmony",
    description: "Load when choosing colors, pairing items, or the user asks what goes with what.",
    body: `
# Color harmony
Base: build on neutrals — navy, charcoal, grey, white, cream, beige, camel, brown, olive, black. Neutrals pair with each other freely, with these exceptions: avoid navy+black as near-identical darks unless clearly intentional; avoid brown+black leathers together.
Rule of three: max 3 colors per outfit (neutrals count, denim blue counts as a neutral).
Recipes that always work:
- Tonal / monochrome: one color family in 2–3 shades (cream sweater, beige chinos, brown loafers). Reads expensive.
- Light top / dark bottom: classic, elongating for most bodies.
- Earth palette: olive, brown, cream, rust, camel.
- Coastal: navy, white, light-blue, stone.
- Contrast pop: neutral outfit + one saturated accent (a burgundy knit, a green cap).
Accent pairs: navy+camel, grey+burgundy, olive+cream, brown+light-blue, charcoal+pink (soft), white+navy+tan.
Skin-tone contrast (only if profile.skin_tone is given — never guess it): higher contrast skin/hair → can carry black/white and saturated colors; lower contrast → softer tones, cream over pure white, charcoal over black.
Seasons: lighter, brighter, breathable colors in summer; deeper, richer, warmer tones in autumn/winter. White footwear works year-round when it's dry.`,
  },
  {
    name: "proportion-fit",
    description: "Load when the user asks about fit, body shape, height, or how something should look on them.",
    body: `
# Proportion & fit
Silhouette balance: pair volume with structure — wide/relaxed trousers + fitted or cropped top; slim trousers + relaxed top is fine too, but avoid oversized top + oversized bottom unless it's a deliberate streetwear look.
Height:
- Shorter (<172cm): tonal outfits, minimal contrast at the waist, no/short break on trousers, tuck or half-tuck, avoid long overcoats past the knee.
- Taller (>185cm): can carry longer coats, wider trousers, more contrast and layering; color-blocking at the waist breaks height pleasantly.
Fit checkpoints: shoulder seam at the shoulder bone; sleeves end at the wrist bone; t-shirt sleeve hits mid-bicep; trousers with slight or no break; jacket covers the seat when the look is formal.
Builds: broad/athletic → structured shoulders, avoid shiny tight knits; slim → texture and layering add presence; larger frame → vertical lines, darker tonal outfits, mid-weight fabrics that drape.
Tuck logic: tuck shirts with trousers/chinos; untucked only if the hem is straight and ends mid-fly.
Respect profile.avoid and stated preferences above all of these rules.`,
  },
  {
    name: "dress-codes",
    description: "Load when the user mentions an event, dress code, office, wedding, interview, dinner, date.",
    body: `
# Dress codes (formality 1–5)
1 Lounge: sweats, slides — home only.
2 Casual: tees, jeans, shorts, sneakers, hoodies.
3 Smart casual: collared shirts/polos/knits, chinos/dark jeans/trousers, loafers/clean sneakers/boots, optional overshirt/unstructured blazer. The default for dinners, dates, creative offices.
4 Business: tailored trousers, button-up shirt, blazer or knit, leather shoes. Tie optional (business casual = no tie).
5 Formal: suit or dark tailoring, dress shoes; black tie = tuxedo.
Event playbooks:
- First date / dinner: smart casual, one point of interest (texture or color), clean shoes.
- Job interview: one level above the company's daily dress code.
- Wedding guest: never white; respect the invite's code; daytime/outdoor → lighter colors and fabrics.
- Funeral: dark, muted, formal-leaning.
- Religious or cultural sites: covered shoulders and knees; ask the user if unsure.
- Beach / pool: linen, swim shorts, slides/sandals, cap, sunglasses.
- Travel day: comfort + layers + pockets, shoes you can walk in, wrinkle-resistant fabrics.
If the dress code is unclear, ASK one short question (use ask_user with options).`,
  },
  {
    name: "weather-layering",
    description: "Load whenever weather matters (outdoors, travel, a specific day). Maps forecast → layers & fabrics.",
    body: `
# Weather → clothing
Use feels-like temperature when available.
- ≥ 28°C: single breathable layer — linen, light cotton, shorts OK for casual; light colors; sandals/loafers without socks.
- 22–27°C: tee/polo/short-sleeve shirt; chinos, light trousers or shorts; sneakers/loafers.
- 17–21°C: long-sleeve shirt or tee + light overshirt; carry a layer for the evening.
- 11–16°C: knit or shirt + jacket (overshirt, chore jacket, denim, bomber); jeans/trousers; boots or sneakers.
- 5–10°C: sweater + coat; wool; closed shoes.
- < 5°C: thermal/heavy knit + warm coat (warmth 5), scarf, beanie; boots.
Rain chance > 50% or precipitation > 1mm: water-resistant outer, avoid suede and light canvas shoes, avoid trousers that drag.
Wind > 25 km/h: windproof outer, avoid flowy pieces.
Big day/night swing (>8°C): layer so the outer layer can come off.
Humidity/heat: avoid polyester; prefer linen/cotton; looser fits.
Always mention the forecast in one short line when you used it ("17°C, light rain after 6pm").`,
  },
  {
    name: "culture-context",
    description: "Load when travel, a different country/city, local norms, or cultural/religious events come up.",
    body: `
# Cultural & regional context
- Respect local norms first; when unsure, ask or default to slightly more covered and slightly more formal.
- Middle East & North Africa: modest dressing in public/religious spaces (shoulders, knees covered); long trousers for men are the norm outside the beach/resorts; light, loose, breathable fabrics in heat.
- Southern Europe: smart-casual is the baseline for evenings; shorts at dinner reads touristy in cities; leather loafers/clean sneakers.
- Northern Europe / Scandinavia: minimal, tonal, quality outerwear and good shoes; layers for changeable weather.
- Japan / Korea: neat, layered, well-fitted; easy-off shoes when visiting homes/temples.
- US: wide range; casual is acceptable in most places; offices vary — ask.
- Places of worship everywhere: covered shoulders/knees, remove hats where customary.
Time awareness: weekday vs weekend, daytime vs evening, and local season (southern hemisphere is flipped) all change the answer.`,
  },
  {
    name: "wardrobe-gaps",
    description: "Load when analysing the closet, suggesting purchases, or the user asks what to buy.",
    body: `
# Wardrobe gaps & smart shopping
Capsule targets (adjust to climate & lifestyle): ~6–10 tops, 4–6 bottoms, 2–4 outer layers, 3–4 pairs of shoes (one sneaker, one smart, one weather-proof, one seasonal), a few accessories.
Versatility first: suggest items that unlock the MOST new outfits with what the user already owns. State the count ("pairs with 7 of your pieces").
Typical gaps to check: no shorts for summer; only black/white tops (add navy, cream, olive, light-blue); no smart shoe; no rain-friendly outer; no warm coat for a cold climate; no mid-layer knit; nothing for the stated lifestyle (gym, office, events).
Priority: 1 = fills a real gap for upcoming needs/weather, 2 = high versatility upgrade, 3 = nice to have.
Quality over quantity: recommend fabric and fit specifically ("heavyweight 240gsm cotton", "relaxed straight leg, mid rise").
Use profile.sizes, height, budget and currency. Respect avoid lists.
When searching for products: prefer reputable retailers that ship to the user's country; include price and a real link only if you actually found it (never invent URLs).`,
  },
];

export function skillIndex() {
  return SKILLS.map((s) => `- ${s.name}: ${s.description}`).join("\n");
}

export function getSkill(name: string) {
  return SKILLS.find((s) => s.name === name);
}
