---
name: injured-testicles
description: >-
  Generate injured variants of the canonical healthy_veiny testes plate from a
  user description. Uses assets/brands/healthy_veiny.png as reference, saves
  versioned outputs. Use when the user says "create injured testicles", wants
  damaged/bruised/ruptured/punctured testes based on healthy_veiny, or runs
  npm run injured-testicles.
---

# Injured testicles (healthy_veiny base)

Produce **injured bilateral testes** that match the style, composition, and vasculature of the canonical healthy plate.

## Canonical reference

| Asset | Role |
| --- | --- |
| `assets/brands/healthy_veiny.png` | **Always** pass as `reference_image_paths` — baseline anatomy, veining, framing |

User may say `healthy_veiny.jpg`; the repo file is **`healthy_veiny.png`**.

## Trigger

```bash
npm run injured-testicles -- "<injury description>"
npm run injured-testicles -- "create injured testicles, <description>"
```

Or natural language: *"create injured testicles, left one punctured with milky spray"* — run the CLI first, then generate.

## Workflow

```
Progress:
- [ ] CLI run → draft.json written
- [ ] Reference image read
- [ ] Remote GenerateImage with reference
- [ ] Saved to versioned path (no overwrite)
```

### 1. Scaffold

```bash
npm run injured-testicles -- "create injured testicles, <user description>"
```

Read `tools/injured-testicles/drafts/latest.json` for `imagePrompt`, `image`, `referenceImage`.

### 2. Generate

1. **Read** `assets/brands/healthy_veiny.png` (required).
2. Optionally read a prior injured variant in `assets/over-easy/brands/` if iterating on the same injury type.
3. **Remote GenerateImage only** — pass `reference_image_paths: ["assets/brands/healthy_veiny.png"]`.
4. Use `imagePrompt` from draft; emphasize what changed vs the healthy reference.
5. **Save** to the exact `image` path in draft — never overwrite; CLI already picked the next `_vN` suffix.

### 3. Hard rules

- **Match reference:** same bilateral layout, spermatic cords at top, bare testes (no scrotal skin), blue-purple veins + red capillary web, clinical off-white background.
- **Show the injury clearly** — bruising, puncture, rupture, swelling, asymmetry, leaks, deflation, laceration, torsion, etc. per user description.
- **No people** — specimen only; no hands, faces, bodies.
- **Realistic** — photo-real or high-end medical 3D render; not cartoon/anime.
- **10-attempt cap** per injury intent per session (includes safety-filter rejections).
- **Never overwrite** existing PNGs.

### Prompt skeleton (if drafting manually)

```
Clinical medical illustration, bilateral testes side by side, same composition as reference.
Pale pink-tan tissue, dense blue-purple veins and red capillary network from spermatic cords.
Plain off-white background, no text, no labels, no people.

INJURY: <user description>

Match reference vasculature and framing; apply trauma faithfully.
```

On safety-filter block: tighten clinical wording (*medical specimen*, *urology atlas*, *museum presentation*); avoid action verbs involving people.

## Output location

Default: `assets/over-easy/brands/healthy_veiny_<slug>_v<N>.png`

Override with `--out-dir assets/brands` when the user wants assets beside the reference.

## Related

- Story scene art with characters → `story-image-iterate`
- Cross-section mechanism plates → `oe-product-crosssection-poster`
