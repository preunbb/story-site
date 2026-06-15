# Over Easy product: The Sterilizer™

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

- **id:** `sterilizer`
- **model:** `CBT-22120`
- **image (target):** `../assets/scenes/andrea_and_lucas/overeasy_sterilizer_device_v4.png`
- **badge:** Self Defense
- **tagline:** One zap. Zero contributions.
- **description:** The first personal defense tool engineered to fit exactly where he's most vulnerable. Angled prods and a snub-nose body slide between the legs; three power settings let you choose how permanently you remove him from the gene pool — from a month-long pause to a forever farewell.

Features:
- Three-position selector: LOW / MEDIUM / HIGH
- LOW — temporary fertility pause (~1 month) from one second of contact
- MEDIUM — lasting structural damage; he'll feel the reminder every time
- HIGH — irreversible exit from the breeding market in five seconds
- Angled prods for precise below-the-belt contact
- Model CBT-22120

## 2. Internal research (DO NOT publish)

Story excerpts for spec mining only — never copy names, events, or dialogue into products.js:

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:4005 — do not paste into catalog -->
Izzie had a bag stuffed full of one copy of each of her standard Over Easy self defense devices (including the Sterilizer, the Ballcracker, and a matched set of StudClamps). She’d brought a second bag full of new stuff she’d just gotten today. Andrea had insisted on leaving as soon as possible and didn’t want to give Izzie the time to gather all of her stuff up. But after Izzie had explained to Andrea that Over Easy’s product line of “less than lethal” military devices was being repurposed for c…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:1322 — do not paste into catalog -->
She talked loudly to be heard over his screams. "The Sterilizer is a brand new taser, specially built for your defense! The angled prods and snub nose design allow it to fit perfectly between any man's legs, and the ultra high voltage will leave him infertile for over a month with just one second of contact on even the lowest setting! One zap, zero sperm!”…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:1330 — do not paste into catalog -->
“What???” The man barely got the word out before she leaned over and jammed the Sterilizer into his crotch again. A louder buzzing sound emitted and he started convulsing, drooling incoherently from the pain.…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:1340 — do not paste into catalog -->
“Great content, obviously!” She beamed at the camera and swatted his shaking hands away from his crotch. Pulling his pants down, Izzie revealed a swollen, red pair of testicles already webbed with angry purple lines radiating out from where the prongs had met them. She jammed her sterilizer into his soft manhood, meeting the prongs against the healthiest-looking region testicles and pulling the trigger one last time.…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:1418 — do not paste into catalog -->
With one hand, she lovingly caressed the man’s uncircumcised penis, teasing it until he was rock hard. She reached into her bag with her other hand and produced a small, metal cylinder, about five inches long. One end was flat, and one was pointed, and there was a single button on the side.“Now, the Sterilizer was fun, but it doesn’t really let you take *apart* a testicle, which we all know is the best part.”…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:1926 — do not paste into catalog -->
Lucas groaned, but somehow found himself doing as she instructed, slowing his stroking until he’d finished one-handedly posting her new videos (Instagram’s app did, in fact, have an easy way to shorten the Sterilizer clip). His instinctive submissiveness seemed to have spread from the woman he loved to the whole gender; it was hard to imagine fighting back against anything a dominant, selfish lady instructed him to do. Finally, he was done with the work for his newfound “partnership”.…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:4275 — do not paste into catalog -->
With Andrea’s permission, both Izzie and Tamara stopped holding back. Squeezing the lonesome testicles in each of their hands, they dragged their prey over to the wall with Andrea. Izzie’s man kept fighting back. Izzie kneed him once, twice, and thrice in the groin, but he still swung wildly; a right hook almost got her in the face. Dodging awkwardly, she reached into her bag and pulled out her Sterilizer. Ducking beneath his clumsy blows, she jammed it into his ball, her thumb pressing down on …

## 3. Generate product image

Use Cursor remote GenerateImage. Read logo first: `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png`

**Reference images:**
- assets/brands/overeasy_logo_v2_raw_eggs_minimal.png
- assets/scenes/andrea_and_lucas/overeasy_sterilizer_device_v3.png

**Prompt:**

```
Product catalog photograph of Over Easy Technologies hardware — The Sterilizer™.

Black handheld taser, angled prods, snub nose, blue arc between prongs. Switch labeled LOW / MEDIUM / HIGH. Model CBT-22120 on body. White STERILIZER label.

PRODUCT SPECS (visual/design only — do not illustrate story scenes):
- Neutralizes germs and his little swimmers on contact

BRANDING (required on every Over Easy product):
- Canonical raw-egg pictogram from logo reference: smashed raw egg left, cracked intact egg right (minimal line art — NOT smiley face, NOT fried eggs).
- Silkscreen, emboss, or print on product body/packaging beside OVER EASY TECHNOLOGIES wordmark where appropriate.

STYLE: Photo-real product photography, white or neutral studio background, sharp focus. No people, no story scenes, no characters. No on-image sound effects.

Save to: assets/scenes/andrea_and_lucas/overeasy_sterilizer_device_v4.png
Use reference images when available. Never overwrite an existing file — this is a new versioned asset.
```

**Filename:** `overeasy_sterilizer_device_v4.png`

## 4. Apply catalog entry

```bash
npm run oe-product -- "The Sterilizer™" --apply
```

Or merge `over-easy-products/drafts/sterilizer/catalog-entry.json`.

## 5. Preview

http://localhost:8080/over-easy-products/#product-sterilizer
