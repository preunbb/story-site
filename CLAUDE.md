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
2. **Painterly-real** — if photo-real keeps getting refused, fall back to a tight, realistic painted style: oil painting, gouache, digital painting in the manner of a film matte painter or a classical figure painter. Brushwork can show, but proportions, anatomy, lighting, and faces must still read as a real adult human in a real space.

Avoid going further toward stylization than that. **Do not** generate cartoon, comic-book, anime, manga, chibi, Pixar/3D-cartoon, webcomic, sticker, vector-art, or "wholesome illustrated children's book" styles for new images. No big-eye/small-mouth styling, no thick black outlines, no flat cel-shaded looks, no comic speech bubbles or onomatopoeia ("WHAM!", "POP!", "*SQUELCH*") burned into the image. Sound effects belong in the prose, not on the canvas. Older comic-style images in the repo are legacy — don't use them as a stylistic target for new work.

Lean into:

- Naturalistic skin tones, pores, freckles, blemishes, body hair, sweat, tear tracks, smudged makeup, real chest/belly/thigh fat distribution.
- Real-looking interiors: visible clutter, scuffed paint, worn upholstery, lived-in lighting (warm lamps, cool window light, harsh fluorescent, etc.) that matches the scene's setting and time of day.
- Believable expressions and posture — anatomy that holds up under scrutiny, including hands, feet, and the genitals when they're in frame.

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
