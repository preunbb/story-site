---
name: story-image-iterate
description: >-
  Generate and iteratively refine scene or character images for the story
  catalog via versioned remote generation. Use when creating scene art,
  tweaking an image, generating covers, portraits, or iterating on composition,
  faces, or damage detail.
---

# Story image iteration

Generate images with Cursor's **remote** image generation tool. Do not use `tools/local-image-gen/` unless the user explicitly opts in for that session.

Full project rules also live in `CLAUDE.md` (Image Generation section). This skill is the operational workflow.

## Hard rules

1. **Never overwrite** an existing image file. Every attempt gets a **new versioned filename** (`_v2`, `_v3`, `_two_bulges`, etc.).
2. **Save every iteration** to `assets/scenes/<story_slug>/` or `assets/characters/` immediately — not only the final pick.
3. **10-attempt cap** per image intent per session (including safety-filter rejections). At cap: stop, summarize tries, ask how to proceed.
4. **Read character portraits** from `assets/characters/` before generating anyone in `data/characters.js`. Match hair, build, age, vibe. Same first name = same person across stories.
5. **Register scenes** in `data/stories.js` when adding catalog art.
6. **Never programmatically paint, composite, or draw onto a generated image** (PIL/OpenCV overlays, brush strokes, splatters, text wipe, "fix it in post," etc.). It never looks right. If the model misses a detail, regenerate with a clearer prompt — do not patch pixels by hand.

## Iteration loop

```
Progress:
- [ ] Story beat + cast identified
- [ ] Portrait(s) read
- [ ] Prompt drafted (v1)
- [ ] Generated → saved with new filename
- [ ] Compared to intent → tweak list
- [ ] Repeat until ship or 10 attempts
```

### Before first generation

1. Read the story beat (synced `assets/stories/<id>.md` or user description).
2. Read relevant entries in `data/characters.js` and **open portrait files** with Read tool.
3. For Over Easy product shots: read `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png` first.
4. Choose filename stem: `chNN_<characters>_<beat>_v1.png` (adjust to repo conventions).

### Each iteration

1. State what v(N) should change vs v(N-1) (composition, expression, damage, lighting, etc.).
2. Generate with remote tool.
3. Save to destination with incremented suffix — never reuse a path.
4. Tell the user what changed and what to compare.

### Clothed bulges for big-ball characters

If the man is canonically large (Chad, Lucas, James, or the prose says so), the pants or shorts must show **two separate heavy rounds**, sitting together at the front of the pelvis just under the waistband. Canonical look: `assets/covers/self_defense_ch02_squeezes_v45.jpg`. Ordinary-sized men stay ordinary. Do not substitute a single modest dick-tent, a flat crotch, or two pads sitting out on the thighs.

Do not name anatomy, and do not attach the cast portrait or the v45 still — both get refused. Use this wording instead:

"The front of the sweatpants is pushed out by two large round cushions sitting side by side, just under the drawstring, so the cloth stretches into two separate round bumps."

Hands stay off the waistband. If the bumps land on the thighs, regenerate and stress "just under the drawstring, in the center, not on the thighs."

### Men's faces: no tears

In every prompt that depicts a man in pain, **explicitly forbid tears** (no tear tracks, no crying wet eyes, no streaks on cheeks). Use mouth, brow, eyes wide or squeezed shut, posture, sweat, and pallor instead. Generated tear FX on men reliably look wrong.

### Prompt priorities (subject matter)

Prefer tight, visceral framing:

- **Impact moment** — connection, deformation, specific damage from prose
- **His reaction** — agony, loss, grief where permanent harm is implied (never tears on men)
- **Her reaction** — visible thrill matching the beat

### Visual style

1. Photo-real when allowed
2. Else painterly-real (smooth digital matte — not oily impasto)
3. Never cartoon/anime/comic/on-image sound effects

## After a keeper

1. Add or update `scenes` entry in `data/stories.js` (path + caption).
2. If user wants inline placement → follow `CLAUDE.md` "Inserting Scenes Into Stories" (Drive doc + `[[scene:…]]` tags).
3. Keep all versions on disk for comparison.

## When generation fails

- Safety filter: reframe (tighter face reaction, implied impact, medical/educational framing) — still counts toward cap.
- Wrong face: re-read portrait, paste appearance details into prompt, bump version.
- Wrong anatomy/blocking: simplify pose, fewer bodies in frame, single focal action.

## Related skills

- Male groin-pain faces (FACS prompt block) → `male-ballpain-expression`
- Prose consistency → `story-structural-review`
- Caption/story typos → `story-copy-edit`
