# Over Easy product: Testicular Biopsy Gun™

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

- **id:** `testicular-biopsy-gun`
- **model:** `OET-TBG-1`
- **image (target):** `../assets/scenes/andrea_and_lucas/testicular_biopsy_gun_v1.png`
- **badge:** Hardware
- **tagline:** Engineered for when hints aren't enough.
- **description:** Testicular Biopsy Gun™ — Over Easy hardware for the woman who prefers a firm answer to awkward situations. Discreet enough to carry, decisive enough that he won't need a second explanation.

Features:
- Canonical Over Easy raw-egg pictogram branding
- Designed for confident everyday carry
- Precision coring needle for tissue samples

## 2. Internal research (DO NOT publish)

Story excerpts for spec mining only — never copy names, events, or dialogue into products.js:

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:4007 — do not paste into catalog -->
Tamara had her own bag, although most of the items inside were technically meant for healing testicles rather than harming them. Dozens of scalpels, still sterilized and packaged and ready for use. Needles in every gauge from hair-thin to nearly the width of a ballpoint pen. Rubber hoses for makeshift tourniquets. Mini burdizzos and a portable elastrator and whatever else they might need. She even had a spare testicular biopsy gun she’d grabbed from the office. Andrea had stuffed in a few length…

## 3. Generate product image

Use Cursor remote GenerateImage. Read logo first: `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png`

**Reference images:**
- assets/brands/overeasy_logo_v2_raw_eggs_minimal.png

**Prompt:**

```
Product catalog photograph of Over Easy Technologies hardware — Testicular Biopsy Gun™.

Photo-real Over Easy product on white studio background.

PRODUCT SPECS (visual/design only — do not illustrate story scenes):
- Precision coring needle for tissue samples

BRANDING (required on every Over Easy product):
- Canonical raw-egg pictogram from logo reference: smashed raw egg left, cracked intact egg right (minimal line art — NOT smiley face, NOT fried eggs).
- Silkscreen, emboss, or print on product body/packaging beside OVER EASY TECHNOLOGIES wordmark where appropriate.

STYLE: Photo-real product photography, white or neutral studio background, sharp focus. No people, no story scenes, no characters. No on-image sound effects.

Save to: assets/scenes/andrea_and_lucas/testicular_biopsy_gun_v1.png
Use reference images when available. Never overwrite an existing file — this is a new versioned asset.
```

**Filename:** `testicular_biopsy_gun_v1.png`

## 4. Apply catalog entry

```bash
npm run oe-product -- "Testicular Biopsy Gun™" --apply
```

Or merge `over-easy-products/drafts/testicular-biopsy-gun/catalog-entry.json`.

## 5. Preview

http://localhost:8080/over-easy-products/#product-testicular-biopsy-gun
