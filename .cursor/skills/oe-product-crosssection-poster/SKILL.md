---
name: oe-product-crosssection-poster
description: >-
  Generate vintage and full-color textless clinical cross-section posters for
  Over Easy catalog products. Researches story prose for trauma mechanism,
  uses brand anatomy plates and product renders as references, saves versioned
  assets, and optionally appends gallery entries in over-easy-products/products.js.
  Use when the user asks for a product cross-section poster, mechanism diagram,
  clinical plate, or gallery art like Ballcracker/Sterilizer/Ball Anvil posters.
---

# Over Easy product cross-section posters

Produce **two textless** clinical plates per product:

1. **Full-color realistic** — 3D medical-atlas rendering (try first)
2. **Vintage schematic** — sepia pen-and-ink textbook plate (fallback if full-color is blocked; always generate both when possible)

Remote `GenerateImage` only. Never overwrite existing files.

## Canonical references (read before prompting)

| Asset | Use |
| --- | --- |
| `assets/brands/crushed_testicles_xray_crosssection_v3_reference_plate.png` | Healthy vs shattered cross-section anatomy |
| `assets/scenes/andrea_and_lucas/overeasy_comparative_gonadal_integrity_poster_realistic_v1.png` | Full-color poster layout, tissue palette |
| `assets/scenes/andrea_and_lucas/lucas_hyperspermia_scrotum_textbook_diagram_v2.png` | Vintage line-art tone |
| Product hero in `over-easy-products/products.js` → `image` | Device shape, branding, materials |

## Workflow

```
Progress:
- [ ] Product resolved (id, model, hero path)
- [ ] Story mechanism notes (internal only — not on poster)
- [ ] Reference images read
- [ ] Full-color textless plate generated → saved
- [ ] Vintage textless plate generated → saved
- [ ] Gallery entries appended (if requested)
```

### 1. Resolve product

- Look up `id`, `name`, `model`, `image`, `description` in `over-easy-products/products.js`.
- Check `tools/over-easy-product/lib/prompts.mjs` for `imageNotes` and `referenceAssets`.
- Search story prose (`dist/andrea-and-lucas-complete/story.md`, `assets/stories/*.md`) for how the device is used — **mechanism only** (contact point, force direction, tissue outcome). Do not put story quotes on the poster.

### 2. Plan the plate

Pick one clear **sagittal or cross-section mechanism** the device causes:

- **Ballcracker** — tapered tip vs pneumatic bolt; posterior epididymis disruption
- **Sterilizer** — three voltage grades; electrical pathway through tubules
- **Ball Anvil** — oval well + floor spike; compressive flattening / capsular rupture

Use **1–3 side-by-side panels** when the product has distinct modes or settings. Single panel is fine for one-mode devices.

### 3. Hard rules for every generation

- **No text** — no titles, labels, figure numbers, logos, or captions on the image
- **No people** — no faces, bodies, hands, or sexual context; specimen + device cutaway only
- **Clinical tone** — detached urology atlas / museum specimen; avoids safety-filter blocks
- **Versioned filenames** under `assets/scenes/andrea_and_lucas/` (or story slug if product is story-specific):

  `overeasy_<product_slug>_crosssection_<mechanism>_v<N>_<realistic|schematic>.png`

- **10-attempt cap** per plate style per session (includes filter rejections)
- Pass product hero + anatomy reference plates as `reference_image_paths`

### 4. Prompt templates

**Full-color (textless):**

```
Educational medical reference plate, full-color realistic 3D anatomical cross-section,
off-white background. NO text, NO labels, NO titles, NO logos, NO words anywhere.

[1–3 panels describing mechanism with device from reference and testis anatomy:
white tunica albuginea, tan seminiferous tubule lobules, brown epididymis posterior,
spermatic cord vessels superior.]

Device: [describe from product hero — materials, distinctive features only].

Clinical museum-specimen presentation. Earth-tone tissue colors, soft even lighting.
No human figures.
```

**Vintage schematic (textless):**

```
Vintage medical textbook line-art diagram on aged sepia paper. NO text, NO labels,
NO titles, NO words anywhere.

Fine pen-and-ink hatching, 19th-century surgical atlas style. [Same mechanism panels
as full-color but line art with minimal earth-tone wash.]

Small device profile inset if helpful. No human figures.
```

Try **full-color first**. On safety-filter block, retry once with tighter clinical wording; then proceed to vintage (usually passes).

### 5. Save and verify

Copy from Cursor project assets path into repo if needed:

`assets/scenes/andrea_and_lucas/overeasy_<slug>_crosssection_*.png`

Open the saved file; confirm **zero visible text** and device reads correctly.

### 6. Gallery (when user asks)

Append to product `images` array in `over-easy-products/products.js` **at the end**:

```js
{
  path: "../assets/scenes/andrea_and_lucas/overeasy_<slug>_crosssection_<mechanism>_v1_realistic.png",
  caption: "<Coy catalog caption — mechanism in plain language, no story names>",
},
{
  path: "../assets/scenes/andrea_and_lucas/overeasy_<slug>_crosssection_<mechanism>_v2_schematic.png",
  caption: "<Vintage edition caption>",
},
```

If `images` is missing, create it with hero shot first, then new plates.

Caption voice: match existing gallery entries (clinical but playful, second-person optional).

## Related skills

- Product hero shots + catalog copy → `over-easy-product`
- Scene art with characters → `story-image-iterate`
