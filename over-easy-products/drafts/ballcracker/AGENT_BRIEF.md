# Over Easy product: Ballcracker™

Run this workflow via `.cursor/skills/over-easy-product/SKILL.md`.

## Copy voice (required)

CATALOG COPY RULES (over-easy-products/products.js):

Audience: women shopping Over Easy — confident, amused, in on the joke.

Voice:
- Second person ("you") where natural; empowerment and lifestyle framing.
- Coy implication of testicular consequences — NEVER graphic, NEVER name body parts directly in marketing copy.
- Euphemisms: gene pool, family tree, his "contributions", delicate anatomy, lasting impression, firm message, breeding hazard, below-the-belt confidence, permanent reminder, take him off the market.

Forbidden in published catalog copy:
- Character names (Izzie, Abby, Lucas, Andrea, Kay, etc.)
- Specific story events, chapters, skits, rites, or scenes
- Direct quotes from fiction
- Clinical or pornographic explicitness

Story excerpts are research-only — extract product specs, not prose to paste.

Draft catalog copy is pre-written in coy marketing voice. **Do not** replace it with story quotes or character references.

## 1. Catalog entry (draft — safe to publish)

- **id:** `ballcracker`
- **model:** `OET-B-1`
- **image (target):** `../assets/scenes/andrea_and_lucas/overeasy_ballcracker_device_v1.png`
- **badge:** Hardware
- **tagline:** Engineered for when hints aren't enough.
- **description:** Ballcracker™ — Over Easy hardware for the woman who prefers a firm answer to awkward situations. Discreet enough to carry, decisive enough that he won't need a second explanation.

Features:
- Canonical Over Easy raw-egg pictogram branding
- Edit features in over-easy-products/products.js

## 2. Internal research (DO NOT publish)

Story excerpts for spec mining only — never copy names, events, or dialogue into products.js:

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:4005 — do not paste into catalog -->
Izzie had a bag stuffed full of one copy of each of her standard Over Easy self defense devices (including the Sterilizer, the Ballcracker, and a matched set of StudClamps). She’d brought a second bag full of new stuff she’d just gotten today. Andrea had insisted on leaving as soon as possible and didn’t want to give Izzie the time to gather all of her stuff up. But after Izzie had explained to Andrea that Over Easy’s product line of “less than lethal” military devices was being repurposed for c…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:1425 — do not paste into catalog -->
“For the girls who want a more manual self defense experience, we have the Ballcracker!”…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:1442 — do not paste into catalog -->
She flipped the Ballcracker around and positioned the flat end against the back of his healthy right nut. He quivered in terror and tried to protect himself, but a quick punch to his badly ruptured left testicle kept him from doing more than foaming at the mouth and whimpering.…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:1444 — do not paste into catalog -->
Izzie lined the back of the Ballcracker up against the back of the massive healthy testicle. Thick, ropy ballcords connected the truly spectacular organs to the man. Then she casually pressed the button.…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:1448 — do not paste into catalog -->
She pulled the Ballcracker away. The man slowly fell to the ground, shakily twisting around until he was in front of the toilet, and lost his lunch into it.…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:1470 — do not paste into catalog -->
“Yeah. I mean, the pneumatic bit obliterated it already — like, all those important bits getting destroyed means it can’t make sperm or hormones or whatever for you. So, since it’s already dead, they want us to…” She reread a text on her phone. “Yeah. Turn it inside out, to show how effective the Ballcracker is. Then we’ll save what’s left of your left nut, and you’ll still be able to have kids. And sex.”…

## 3. Generate product image

Use Cursor remote GenerateImage. Read logo first: `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png`

**Reference images:**
- assets/brands/overeasy_logo_v2_raw_eggs_minimal.png

**Prompt:**

```
Product catalog photograph of Over Easy Technologies hardware — Ballcracker™.

Photo-real Over Easy product on white studio background.

BRANDING (required on every Over Easy product):
- Canonical raw-egg pictogram from logo reference: smashed raw egg left, cracked intact egg right (minimal line art — NOT smiley face, NOT fried eggs).
- Silkscreen, emboss, or print on product body/packaging beside OVER EASY TECHNOLOGIES wordmark where appropriate.

STYLE: Photo-real product photography, white or neutral studio background, sharp focus. No people, no story scenes, no characters. No on-image sound effects.

Save to: assets/scenes/andrea_and_lucas/overeasy_ballcracker_device_v1.png
Use reference images when available. Never overwrite an existing file — this is a new versioned asset.
```

**Filename:** `overeasy_ballcracker_device_v1.png`

## 4. Apply catalog entry

```bash
npm run oe-product -- "Ballcracker™" --apply
```

Or merge `over-easy-products/drafts/ballcracker/catalog-entry.json`.

## 5. Preview

http://localhost:8080/over-easy-products/#product-ballcracker
