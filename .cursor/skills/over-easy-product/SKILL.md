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

**Published catalog:** `over-easy-products/products.js` (copy) + `assets/scenes/...` (images).

**Draft scratch:** `over-easy-products/drafts/<slug>/draft.json` — image workflow only; safe to delete after apply.

## Catalog copy voice (required)

**Audience:** women buying Over Easy — confident, amused, in on the joke.

- **Coy implication** of testicular consequences; never graphic, never name gonads directly in marketing text.
- Euphemisms: gene pool, family tree, his "contributions", delicate anatomy, lasting impression, breeding hazard, below-the-belt, take him off the market.
- **Second person** ("you") where natural; empowerment and lifestyle framing.

**Never in published catalog copy:**

- Character names or specific story events
- Quotes from fiction
- Clinical/pornographic explicitness

Story excerpts in `draft.json` are **internal research only** — mine specs, don't paste prose.

## Trigger

```bash
npm run oe-product -- "Product Name"
```

## Step 1 — Scaffold draft

Writes **one file:** `over-easy-products/drafts/<slug>/draft.json`

Contains: `imagePrompt`, `assetFilename`, `referenceAssets`, `productSpecs`, `excerpts` (internal). Does **not** hold published copy for existing products.

## Step 2 — Generate product image

1. Read `draft.json`.
2. Read `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png`.
3. Use `referenceAssets` / `existingAssets` from draft as reference images.
4. Remote GenerateImage only; save to versioned path in `assetFilename`.
5. Raw-egg pictogram on every product. No people, no story scenes.

## Step 3 — Edit catalog copy

Edit **`over-easy-products/products.js`** for tagline, description, and features.

For **new** products, `draft.json` may include `starterCatalogEntry` — tweak in `products.js` before `--apply`.

## Step 4 — Apply

```bash
npm run oe-product -- "<Product Name>" --apply
```

- **Existing product:** updates `image` path only; copy untouched.
- **New product:** appends starter entry from scaffold (after you edited `products.js`).

## Step 5 — Preview

`http://localhost:8080/over-easy-products/#product-<slug>`

## Quick path (agent)

1. `npm run oe-product -- "X"`
2. Read `drafts/<slug>/draft.json`; generate image
3. Edit copy in `products.js` if needed
4. `npm run oe-product -- "X" --apply`
5. Delete draft folder when done (optional)

## Do not

- Put Izzie/Abby/Lucas/etc. or skit/rite events in catalog copy
- Paste story sentences into tagline/description/features
- Overwrite images without new version suffix
- Maintain copy in draft files — `products.js` only
