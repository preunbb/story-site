---
name: over-easy-product
description: >-
  Add a new Over Easy Technologies product to the catalog: search story prose
  for product specs (internal only), write coy female-audience marketing copy,
  generate a versioned product image with canonical egg branding, and update
  over-easy-products/products.js. Use when the user names an Over Easy product
  or asks to add oe-product.
---

# Over Easy product catalog workflow

Add one product: **internal story research → coy marketing copy → image → catalog entry**.

Project rules: `CLAUDE.md` (Over Easy branding). Copy voice: `tools/over-easy-product/lib/copy-voice.mjs`.

## Catalog copy voice (required)

**Audience:** women buying Over Easy — confident, amused, in on the joke.

- **Coy implication** of testicular consequences; never graphic, never name gonads directly in marketing text.
- Euphemisms: gene pool, family tree, his "contributions", delicate anatomy, lasting impression, breeding hazard, below-the-belt, take him off the market.
- **Second person** ("you") where natural; empowerment and lifestyle framing.

**Never in published catalog copy:**

- Character names or specific story events
- Quotes from fiction
- Clinical/pornographic explicitness

Story excerpts in drafts are **internal research only** — mine specs, don't paste prose.

## Trigger

```bash
npm run oe-product -- "Product Name"
```

## Step 1 — Scaffold draft

Writes `over-easy-products/drafts/<slug>/` with pre-written marketing copy, `copy-voice.txt`, `AGENT_BRIEF.md`, `image-prompt.txt`.

## Step 2 — Generate product image

1. Read `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png`.
2. Use reference assets from brief.
3. Remote GenerateImage only; save versioned path from brief.
4. Raw-egg pictogram on every product. No people, no story scenes.

## Step 3 — Review copy

Draft copy is auto-generated in marketing voice. Tweak in draft JSON or `products.js` if needed — **keep the voice rules above**.

Do **not** replace with story quotes or character references.

## Step 4 — Apply

```bash
npm run oe-product -- "<Product Name>" --apply
```

`--force` replaces existing id.

## Step 5 — Preview

`http://localhost:8080/over-easy-products/#product-<slug>`

## Quick path (agent)

1. `npm run oe-product -- "X"`
2. Read brief; generate image
3. Adjust copy only if needed (stay coy, no lore)
4. `npm run oe-product -- "X" --apply`

## Do not

- Put Izzie/Abby/Lucas/etc. or skit/rite events in catalog copy
- Paste story sentences into tagline/description/features
- Overwrite images without new version suffix
