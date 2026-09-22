# Injured testicles generator

Generate injured variants of the canonical **healthy veiny testes** plate from a short description.

**Reference:** `assets/brands/healthy_veiny.png` (bilateral bare testes with prominent blue veins and red capillaries).

## Usage

```bash
npm run injured-testicles -- "punctured left testis, milky white fluid spraying outward"
npm run injured-testicles -- "create injured testicles, both swollen and bruised deep purple"
npm run injured-testicles -- "right testis ruptured flat, left intact but torsion-twisted" --out-dir assets/brands
```

The CLI does **not** call an image API. It:

1. Parses your injury description (strips prefixes like `create injured testicles,`).
2. Picks the next versioned filename under `assets/over-easy/brands/` (or `--out-dir`).
3. Writes `tools/injured-testicles/drafts/latest.json` with the full prompt and paths.

In Cursor, ask the agent to run the command (or read the draft) and generate with **remote GenerateImage**, passing `assets/brands/healthy_veiny.png` as a reference image.

## Output naming

`healthy_veiny_<injury-slug>_v<N>.png` — e.g. `healthy_veiny_punctured_left_milky_spray_v1.png`.

Never overwrites existing files; version increments automatically.

## Agent skill

See `.cursor/skills/injured-testicles/SKILL.md` for the full agent workflow.
