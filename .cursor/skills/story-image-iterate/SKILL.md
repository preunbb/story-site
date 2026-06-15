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

### Prompt priorities (subject matter)

Prefer tight, visceral framing:

- **Impact moment** — connection, deformation, specific damage from prose
- **His reaction** — agony, loss, grief where permanent harm is implied
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

- Prose consistency → `story-structural-review`
- Caption/story typos → `story-copy-edit`
