# Over Easy product: Shell Shaker™

Run this workflow via `.cursor/skills/over-easy-product/SKILL.md`.

## 1. Story excerpts (already gathered)



## 2. Catalog entry (draft)

- **id:** `shell-shaker`
- **model:** `OET-SS-1`
- **image (target):** `../assets/scenes/andrea_and_lucas/overeasy_shell_shaker_device_v1.png`
- **badge:** Hardware

Edit copy in `over-easy-products/products.js` after reviewing.

## 3. Generate product image

Use Cursor remote GenerateImage. Read logo first: `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png`

**Reference images:**
- assets/brands/overeasy_logo_v2_raw_eggs_minimal.png

**Prompt:**

```
Product catalog photograph of Over Easy Technologies hardware — Shell Shaker™.

Photo-real Over Easy product on white studio background. Match details from story excerpts.

BRANDING (required on every Over Easy product):
- Canonical raw-egg pictogram from logo reference: smashed raw egg left, cracked intact egg right (minimal line art — NOT smiley face, NOT fried eggs).
- Silkscreen, emboss, or print on product body/packaging beside OVER EASY TECHNOLOGIES wordmark where appropriate.

STYLE: Photo-real product photography, white or neutral studio background, sharp focus. No people unless story beat requires it. No on-image sound effects.

Save to: assets/scenes/andrea_and_lucas/overeasy_shell_shaker_device_v1.png
Use reference images when available. Never overwrite an existing file — this is a new versioned asset.
```

**Filename:** `overeasy_shell_shaker_device_v1.png`

## 4. Apply catalog entry

```bash
npm run oe-product -- "Shell Shaker™" --apply
```

Or merge the draft JSON at `over-easy-products/drafts/shell-shaker/catalog-entry.json`.

## 5. Preview

http://localhost:8080/over-easy-products/#product-shell-shaker
