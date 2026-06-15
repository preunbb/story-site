# Over Easy product: Bleach Wipes™

Run this workflow via `.cursor/skills/over-easy-product/SKILL.md`.

## Copy voice (required)

CATALOG COPY RULES (over-easy-products/products.js):

Audience: women shopping Over Easy — confident, amused, in on the joke.

Voice:
- Second person ("you") where natural; empowerment and lifestyle framing.
- Coy implication of testicular consequences — NEVER graphic, NEVER name body parts directly in marketing copy.
- Euphemisms: gene pool, family tree, his "contributions", delicate anatomy, lasting impression, firm message, breeding hazard, below-the-belt confidence, permanent reminder, take him off the market.

Forbidden in published catalog copy:
- Character names (Izzie, Abby, Lucas, Andrea, Kay, etc.)
- Specific story events, chapters, skits, rites, or scenes
- Direct quotes from fiction
- Clinical or pornographic explicitness

Story excerpts are research-only — extract product specs, not prose to paste.

Draft catalog copy is pre-written in coy marketing voice. **Do not** replace it with story quotes or character references.

## 1. Catalog entry (draft — safe to publish)

- **id:** `bleach-wipes`
- **model:** `OET-BW-40`
- **image (target):** `../assets/scenes/andrea_and_lucas/overeasy_bleach_wipes_box_v3.png`
- **badge:** Hygiene
- **tagline:** Snuff out the breeding hazard.
- **description:** Patented bleach wipes strong enough to neutralize every germ — and every ambitious swimmer — they touch, yet gentle enough for your most delicate cleanup. When the evening went your way and his contributions absolutely did not.

Features:
- Pull-tab wet-wipe dispenser pack
- Neutralizes swimmers on contact — skin, fabric, or floor
- Deep-clean safe for post-encounter sensitive areas
- Essential after any serious breeding hazard
- 40-count travel pack

## 2. Internal research (DO NOT publish)

Story excerpts for spec mining only — never copy names, events, or dialogue into products.js:

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:1586 — do not paste into catalog -->
“When you need to clean up a serious breeding hazard, Over Easy has you covered too! Their patented bleach wipes are strong enough to take out every single germ and sperm they touch, but gentle enough to use on even your most delicate bits!”…

## 3. Generate product image

Use Cursor remote GenerateImage. Read logo first: `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png`

**Reference images:**
- assets/brands/overeasy_logo_v2_raw_eggs_minimal.png
- assets/scenes/andrea_and_lucas/overeasy_bleach_wipes_box_v2.png

**Prompt:**

```
Product catalog photograph of Over Easy Technologies retail packaging — Bleach Wipes™.

Retail wipe box, orange/white Over Easy branding, dense cartoony terrified sperm mascots with long tails being dissolved/wiped (PG cartoon).

BRANDING (required on every Over Easy product):
- Canonical raw-egg pictogram from logo reference: smashed raw egg left, cracked intact egg right (minimal line art — NOT smiley face, NOT fried eggs).
- Silkscreen, emboss, or print on product body/packaging beside OVER EASY TECHNOLOGIES wordmark where appropriate.

STYLE: Photo-real product photography, white or neutral studio background, sharp focus. No people, no story scenes, no characters. No on-image sound effects.

Save to: assets/scenes/andrea_and_lucas/overeasy_bleach_wipes_box_v3.png
Use reference images when available. Never overwrite an existing file — this is a new versioned asset.
```

**Filename:** `overeasy_bleach_wipes_box_v3.png`

## 4. Apply catalog entry

```bash
npm run oe-product -- "Bleach Wipes™" --apply
```

Or merge `over-easy-products/drafts/bleach-wipes/catalog-entry.json`.

## 5. Preview

http://localhost:8080/over-easy-products/#product-bleach-wipes
