# Over Easy product: Ball Killers™

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

- **id:** `ball-killers`
- **model:** `OET-BK-1`
- **image (target):** `../assets/scenes/andrea_and_lucas/overeasy_ball_killers_v1.png`
- **badge:** Fashion
- **tagline:** Fashionable. Functional. Pointed.
- **description:** Self-defense you can wear to dinner. Glossy patent pumps with blood-red soles and tungsten-tipped points at heel and toe — as sexy on the dance floor as they are useful when someone needs a very direct lesson in boundaries.

Features:
- Shiny black patent upper; blood-red lacquered sole
- "ball" / "killer" printed on each shoe in bright red
- Dual contact points — heel stem and toe — capped in tungsten
- Stiletto geometry for maximum leverage (dry cleaning not included)
- Sold as a matched pair

## 2. Internal research (DO NOT publish)

Story excerpts for spec mining only — never copy names, events, or dialogue into products.js:

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:1604 — do not paste into catalog -->
“First up: the Ball Killers!”…

## 3. Generate product image

Use Cursor remote GenerateImage. Read logo first: `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png`

**Reference images:**
- assets/brands/overeasy_logo_v2_raw_eggs_minimal.png
- assets/scenes/andrea_and_lucas/overeasy_ball_killers_heels_v1.png

**Prompt:**

```
Product catalog photograph of Over Easy Technologies fashion product — Ball Killers™.

Shiny black patent heel pair, blood-red soles, 'ball' and 'killer' in bright red on each shoe, tungsten-capped points at heel and toe.

BRANDING (required on every Over Easy product):
- Canonical raw-egg pictogram from logo reference: smashed raw egg left, cracked intact egg right (minimal line art — NOT smiley face, NOT fried eggs).
- Silkscreen, emboss, or print on product body/packaging beside OVER EASY TECHNOLOGIES wordmark where appropriate.

STYLE: Photo-real product photography, white or neutral studio background, sharp focus. No people, no story scenes, no characters. No on-image sound effects.

Save to: assets/scenes/andrea_and_lucas/overeasy_ball_killers_v1.png
Use reference images when available. Never overwrite an existing file — this is a new versioned asset.
```

**Filename:** `overeasy_ball_killers_v1.png`

## 4. Apply catalog entry

```bash
npm run oe-product -- "Ball Killers™" --apply
```

Or merge `over-easy-products/drafts/ball-killers/catalog-entry.json`.

## 5. Preview

http://localhost:8080/over-easy-products/#product-ball-killers
