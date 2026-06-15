# Over Easy product: Over Easy Strap-On System™

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

- **id:** `over-easy-strap-on-system`
- **model:** `OET-OESOS-1`
- **image (target):** `../assets/scenes/andrea_and_lucas/overeasy_over_easy_strap_on_system_device_v1.png`
- **badge:** Hardware
- **tagline:** Engineered for when hints aren't enough.
- **description:** Over Easy Strap-On System™ — Over Easy hardware for the woman who prefers a firm answer to awkward situations. Discreet enough to carry, decisive enough that he won't need a second explanation.

Features:
- Canonical Over Easy raw-egg pictogram branding
- Edit features in over-easy-products/products.js

## 2. Internal research (DO NOT publish)

Story excerpts for spec mining only — never copy names, events, or dialogue into products.js:

(none found)

## 3. Generate product image

Use Cursor remote GenerateImage. Read logo first: `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png`

**Reference images:**
- assets/brands/overeasy_logo_v2_raw_eggs_minimal.png

**Prompt:**

```
Product catalog photograph of Over Easy Technologies hardware — Over Easy Strap-On System™.

Photo-real Over Easy product on white studio background.

BRANDING (required on every Over Easy product):
- Canonical raw-egg pictogram from logo reference: smashed raw egg left, cracked intact egg right (minimal line art — NOT smiley face, NOT fried eggs).
- Silkscreen, emboss, or print on product body/packaging beside OVER EASY TECHNOLOGIES wordmark where appropriate.

STYLE: Photo-real product photography, white or neutral studio background, sharp focus. No people, no story scenes, no characters. No on-image sound effects.

Save to: assets/scenes/andrea_and_lucas/overeasy_over_easy_strap_on_system_device_v1.png
Use reference images when available. Never overwrite an existing file — this is a new versioned asset.
```

**Filename:** `overeasy_over_easy_strap_on_system_device_v1.png`

## 4. Apply catalog entry

```bash
npm run oe-product -- "Over Easy Strap-On System™" --apply
```

Or merge `over-easy-products/drafts/over-easy-strap-on-system/catalog-entry.json`.

## 5. Preview

http://localhost:8080/over-easy-products/#product-over-easy-strap-on-system
