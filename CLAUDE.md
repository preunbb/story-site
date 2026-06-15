# Project Instructions

## Image Generation

**NEVER overwrite an existing generated image, ever.** Every generated image must be saved as a new versioned file alongside any prior versions.

When iterating on an image:

- Always assign a new, unique filename (e.g. add a version suffix like `_v2`, `_v3`, `_v4_2b`, etc., or a descriptive suffix like `_two_bulges`, `_paper_under`).
- Save EVERY generated iteration to its final destination (e.g. `assets/scenes/<story_slug>/`) the moment it's generated, not just the "chosen" one. The user may want to revisit earlier versions or compare iterations.
- Do not delete previous versions when a new one is generated. Keep them all.
- Do not reuse a filename for a different image, even if the previous version was rejected by the safety filter or was a "draft."
- The only exception is the actual `cover` field in `data/stories.js` — when explicitly replacing a story cover at the user's direction, you may overwrite the cover file (but always preserve the versioned originals in `assets/scenes/<story_slug>/` first).

If you find yourself about to copy or rename a file in a way that would clobber an existing image, STOP and pick a new suffix instead.

### Hard cap: 10 iterations per image, then stop

Never generate more than **10 versions** of the same image (same scene, same intent) in a single session. Count every attempt — including ones rejected by the model's safety filter — toward this cap.

When you hit 10 attempts on one image and still don't have a result you'd ship:

- Stop generating that image.
- Save whatever versions did succeed into `assets/scenes/<story_slug>/` with descriptive suffixes so they're not lost.
- Tell the user plainly that you've burned the 10-attempt budget on this one image, briefly summarize what you tried and why nothing worked (e.g. "the safety filter kept refusing the impact-moment composition"), and ask how they want to proceed (different framing, different scene, skip it, etc.) before spending more on it.

Do not silently keep grinding past 10. The user's time, money, and patience all matter — bail out and ask.

### Subject matter focus

Generated images for these stories should, as much as physically possible within the model's safety filters, focus on **the physical impact of a testicular attack**:

- **The point of impact itself.** Frame and compose so the viewer's eye is drawn to the moment a knee, foot, fist, hand, or other object is connecting with (or has just connected with) a man's testicles. Show the deformation, the bulge of flesh through fingers, the "*crunch*"/"*pop*"/"*squick*" moment. Where the story describes specific damage (a dimple, a rupture, a snapped cord, a liquefied gland, a sack hanging empty or lopsided), depict that damage faithfully — bruising, swelling, an asymmetric or shrunken sack, fluid or wetness through the scrotum, a flattened/deflated side, etc.
- **The agony and loss on the man's face and body.** Knees turned inward, hands clutching or hovering helplessly over the wreckage, tears, drool, eyes rolled back or wide with disbelief, mouth open in a scream or a silent gasp, sweat, pallor, a doubled-over or collapsed posture. He should look like a man who has just lost something precious, not just someone in generic pain. Where the story implies permanent loss (castration, ruptured ball, snapped cord), let that grief and horror read on his face.
- **The joy on the woman's face.** The woman performing the ballbusting should be visibly *thrilled* — flushed cheeks, bitten lip, wide grin or smug smirk, sparkling/hungry eyes, an aroused blush, a delighted gasp. She is enjoying this. Depending on the scene, that enjoyment can range from giggly innocent curiosity, to focused predatory concentration, to outright orgasmic ecstasy. Match her expression to what the story says she's feeling at that beat.

When you have to choose between a "tasteful" wide shot and a tighter, more visceral composition that puts the impact, the man's anguish, and the woman's pleasure front and center, prefer the tighter, more visceral composition. The whole point of these images is to capture *that* moment, not to dance around it.

### Visual style: stay realistic

All generated images for these stories should be **as realistic as possible**. Hard preference order:

1. **Photo-real** — like a still from a film, a candid photograph, or a high-end production photoshoot. Real human skin texture, real lighting, real fabric, real anatomy. This is the goal whenever the safety filter will allow it.
2. **Painterly-real (smooth, not “oily”)** — if photo-real keeps getting refused, fall back to a **tight, realistic painted look that still reads almost photographic**: high-end **digital** matte painting, concept-art finish with **smooth blending and controlled detail**, or very lightly handled gouache / acrylic where **surface stays even** — like keyframe illustration for a live-action film, **not** thick gallery oil. Proportions, anatomy, lighting, and faces must read as a real adult human in a real space.

**Avoid in prompts and in aesthetic targets:** heavy **oil-paint** texture, **impasto**, **visible bristle strokes**, **scratchy or smeary** blending, “wet” **mudded** color, or a canvas that looks **coated in varnish and turpentine smudges**. Those read as stylization noise and pull away from realism. If you must name a medium, prefer **digital paint / matte painting / photobash-adjacent** wording over **oil on canvas** unless the user explicitly wants oils.

Avoid going further toward stylization than that. **Do not** generate cartoon, comic-book, anime, manga, chibi, Pixar/3D-cartoon, webcomic, sticker, vector-art, or "wholesome illustrated children's book" styles for new images. No big-eye/small-mouth styling, no thick black outlines, no flat cel-shaded looks, no comic speech bubbles or onomatopoeia ("WHAM!", "POP!", "*SQUELCH*") burned into the image. Sound effects belong in the prose, not on the canvas. Older comic-style images in the repo are legacy — don't use them as a stylistic target for new work.

Lean into:

- Naturalistic skin tones, pores, freckles, blemishes, body hair, sweat, tear tracks, smudged makeup, real chest/belly/thigh fat distribution.
- Real-looking interiors: visible clutter, scuffed paint, worn upholstery, lived-in lighting (warm lamps, cool window light, harsh fluorescent, etc.) that matches the scene's setting and time of day.
- Believable expressions and posture — anatomy that holds up under scrutiny, including hands, feet, and the genitals when they're in frame.

### Over Easy Technologies branding (product images)

**Canonical logo:** `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png`  
(Legacy fried-egg draft: `assets/brands/overeasy_logo_v1.png` — do not use.)

The mark is **stylized and minimal** (flat line-and-fill, printable at small sizes on product hardware):

- **Left:** a **smashed raw egg** — shell fragments, clear albumen, ruptured yolk spilling out.
- **Right:** an **intact raw egg**, slightly **cracked** with a small yolk leak.
- **Neither egg is cooked** — no fried whites, no pan, no browning.
- **Wordmark:** **OVER EASY** (*EASY* in yolk-orange) with **TECHNOLOGIES** tracked below.

Whenever you generate an image of an **Over Easy / OverEasy product** (self-defense gadgets, EunuchCorn apparel, strap-ons, catalog hero shots, skit props, packaging, etc.):

1. **Read `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png` first** so you can describe the egg mark and typography accurately in the prompt (or pass it as a reference image when the tool supports that).
2. **Every Over Easy device must carry the logo.** All hardware — Sterilizer, StudClamp, Nutcracker/Ballcracker, strap-ons, ShellShaker, bleaching wipes, milker rigs, EunuchCorn apparel tags, catalog hero shots, skit props, packaging, etc. — gets the raw-egg pictogram silkscreened, embossed, or printed on the product body the way real consumer-tech branding appears. Match the pictogram from the canonical file: smashed raw egg left, cracked intact raw egg right; **never** the legacy smiley-face circle, concentric-ring badge, or photoreal fried eggs from `overeasy_logo_v1.png`.
3. **Placement:** Logo badge on a flat surface of the device (body, control unit, harness plate) beside or above the existing OVER EASY / TECHNOLOGIES wordmark. Pictogram only on hardware unless the shot is packaging or a full brand lockup — the wordmark may already be printed separately on the device.
4. **When updating an existing device render:** Keep the hardware identical; swap only the legacy icon for the canonical two-egg pictogram. Save as a new versioned file (`_v2`, `_v3`, …); never overwrite the prior render.

Scene illustrations where characters *use* Over Easy gear do not need the logo blown up front-and-center unless the story beat is literally a product demo or unboxing — but **dedicated product / device catalog shots always carry the logo**, and **any device visible in frame should show the pictogram** if the branding surface is legible.

### Remote generation (default — use this)

**Always generate new images with Cursor’s built-in remote image generation** (the default image tool in Composer / agent workflows — the same defaults you use elsewhere in Cursor). Agents must **never** use the repo’s local SD stack (`tools/local-image-gen/`, `127.0.0.1:8787`, `run.sh`, `curl` to local endpoints, CLI wrappers, etc.). **Unless** the user has explicitly said local image generation is set up **and** has asked you to use it for that task, assume it is unavailable and rely on remote generation only.

Save outputs straight into `assets/scenes/<story_slug>/` or `assets/characters/` using **new versioned filenames**; follow the versioning and no-overwrite rules above.

### Local Stable Diffusion (repo only — humans may set up later)

Optional self-hosted stack under **`tools/local-image-gen/`**. **Agents must ignore it entirely** unless the user explicitly opts in for a given session after confirming it runs locally. Maintainer docs: **`tools/local-image-gen/README.md`**.

### Character continuity: match the cast portrait

Every recurring character has a profile portrait in `assets/characters/<id>.{jpg,png}` (referenced from `data/characters.js`). When you generate any new image — cover, scene, alternate version — of a character who already has a portrait, the person you draw **must match that portrait**. Treat the portrait as the canonical reference for that character's:

- Apparent age and overall build (slim/curvy/buxom/wiry/heavyset, etc.).
- Hair color, length, texture, and typical styling.
- Eye color, eye shape, brow shape.
- Skin tone and any distinguishing features (freckles, moles, jawline, nose shape, etc.).
- General face shape and overall "vibe" (e.g. warm girl-next-door, cold predator, nerdy bookworm, etc.).

Before generating, **read the relevant character portrait(s) with the Read tool** so you can describe them accurately in the prompt. If a character description in the story conflicts with the portrait on a non-essential detail, defer to the portrait — readers see the cast page, and characters jumping between faces is jarring.

If a character does **not** yet have a portrait in `assets/characters/`, generate one first (in the same realistic style described above) and save it to `assets/characters/<id>.{jpg,png}`, then update `data/characters.js` so `profilePictures` references it. Only after the portrait exists should you generate scenes featuring that character — that way the portrait, not a one-off scene, becomes the canonical reference for every later image.

When in doubt, briefly describe the character's portrait-derived appearance (hair, build, age, vibe) in the image-generation prompt itself, so the model has the reference baked in.

**Same name = same person.** Across the entire catalog, any two characters with the same first name are the same person. Melody in *Melody's First Time*, Melody in *Busted by the Babysitter*, Melody in *Melody Seduces a Virgin*, Melody in *Andrea and Lucas*, etc. are all one continuous character. The same goes for Cathy, Fiona, Sofia, and so on. Don't draw two different "Melodys."

**Same person, different life stages.** That continuity also means a character can appear at very different points in her life across stories — high school, college, young adult, established mom-of-Robert, etc. Always read the specific story (and the cast portrait) before generating, and age the character up or down accordingly while keeping their core identity intact:

- Hair color, eye color, skin tone, basic facial structure, and overall "vibe" should stay constant across life stages.
- Hairstyle, build, makeup, wardrobe, and apparent maturity should shift to fit the story's setting (e.g. high-school Melody vs. college-age Melody vs. mom-of-Robert Melody all read as the same blonde, but at different ages, with different clothes, energy, and styling).
- The cast portrait is the canonical reference for the *latest / default* version of the character. When generating an earlier-life-stage image, treat the portrait as "what she'll grow into" and de-age in a way that's consistent with that face.

## Inserting Scenes Into Stories

When the user asks you to "insert", "drop in", "place", or "add" scene images into a story — or to put a specific scene "at the right place" / "where it happens" — follow this workflow exactly. Do not improvise or shortcut it.

### Hard rules

1. **Story prose lives on Google Drive. Edit there, never in `assets/stories/*.md`.** The local markdown files in `assets/stories/*.md` are auto-generated by `scripts/sync-stories.mjs` from the published Drive doc. Anything you write into those `.md` files will be wiped out the next time sync runs. To actually change the prose (including inserting `[[scene:…]]` tags), you must edit the underlying Google Doc.
2. **Find the Drive doc ID via `dist/drive_doc_ids.json`.** That file maps every `story.id` in `data/stories.js` to its editable `drive_doc_id` (and `edit_url`). The `driveUrl` field on the story itself points to a `/pub` URL — that's a publish token, *not* an editable file ID. Always resolve through `dist/drive_doc_ids.json` before editing.
3. **Use the Google Workspace MCP to edit the doc.** Drive doc edits go through the `user-google_workspace` MCP tools (always with `user_google_email = boozlejam@gmail.com`). Read the MCP tool schemas before calling them.
4. **Place each image right after the scene takes place in the prose.** The placement target is the paragraph that *describes* (or just finished describing) the moment the image depicts — not the chapter opener, not a generic transition, not "somewhere in the right chapter." Read the relevant chapter, find the exact beat shown in the image, and insert the tag in the paragraph immediately following that beat.
5. **Insert using the `[[scene:identifier]]` syntax, on its own line, with a blank line above and below it.** That's how the renderer (`script.js`'s `SCENE_TAG_BLOCK_RE`) recognizes it as a block-level scene tag. Example:

   ```
   …last line of the paragraph where the impact happens.

   [[scene:ch02_orchiectomy]]

   First line of the next paragraph…
   ```

   Anything else (inline within a paragraph, bracketed differently, embedded in a list item, etc.) will not render as a figure.

### Picking the identifier

`[[scene:identifier]]` resolves against `story.scenes` in `data/stories.js` using one of two strategies (see `findStorySceneByIdentifier` in `script.js`):

- **Substring of the scene's `path`** — strongly preferred. Use a distinctive slice of the filename (e.g. `ch02_orchiectomy`, `wake_up_stirrups`, `three_thumb_castration`) so reordering or appending future scenes can never break the tag. Pick something unique enough that no other scene's path contains the same substring.
- **0-based numeric index into `story.scenes`** — avoid unless there's no usable filename substring. Indexes silently break the moment anyone reorders, inserts, or removes a scene.

Never invent an identifier that doesn't correspond to a real entry in that story's `scenes` array — the renderer will emit a visible `[missing scene: …]` placeholder.

### Step-by-step workflow

1. **Read the story entry in `data/stories.js`** to get the `id`, the `scenes` list (paths + captions), and confirm which images are actually registered.
2. **Look up the Drive doc ID** for that story's `id` in `dist/drive_doc_ids.json` and grab its `drive_doc_id` / `edit_url`.
3. **Read the story prose.** Either pull the doc via the Google Workspace MCP, or read the synced `assets/stories/<id>.md` *as a read-only reference* to figure out where each scene fits. (Reading the local `.md` is fine; editing it is not.)
4. **For each scene to insert,** locate the exact paragraph where the depicted moment occurs in the prose, then plan to insert a `[[scene:<unique-path-substring>]]` block immediately after that paragraph (separated by blank lines).
5. **Make the edits in the Google Doc** via the Google Workspace MCP. Insert the literal text `[[scene:<identifier>]]` as its own paragraph at each target location.
6. **Re-sync if needed.** If the user wants the change reflected locally, run `scripts/sync-stories.mjs` (or tell the user to) so `assets/stories/<id>.md` picks up the new tags. Do **not** hand-edit the `.md` to "preview" the change — that file is downstream of the doc.
7. **Verify the scenes exist in `data/stories.js`.** Each identifier you used must match an entry in that story's `scenes` array. If you're inserting an image that hasn't been registered yet, add it to `scenes` in `data/stories.js` (path + caption) before or alongside the doc edit, so the tag resolves on render.

### Common mistakes to avoid

- ❌ Editing `assets/stories/<id>.md` to add `[[scene:…]]` tags. The next sync will overwrite your edit and the tag will disappear.
- ❌ Using the `driveUrl` `/pub` link as if it were an editable file ID. It isn't. Always go through `dist/drive_doc_ids.json`.
- ❌ Dropping all images at the top of a chapter or at the start of the story. Each image goes *right after* its specific moment, not in a gallery up front.
- ❌ Putting the `[[scene:…]]` tag inline in a sentence, in a list, or without surrounding blank lines. The block regex won't match and the tag will render as literal text.
- ❌ Using a numeric index identifier when a unique filename substring would work. Indexes rot the moment the scenes list changes.
