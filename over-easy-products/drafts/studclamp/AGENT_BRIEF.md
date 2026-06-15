# Over Easy product: StudClamp™

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

- **id:** `studclamp`
- **model:** `OET-S-1`
- **image (target):** `../assets/scenes/andrea_and_lucas/overeasy_studclamp_device_v3.png`
- **badge:** Interrogation
- **tagline:** Dial the pressure. Watch the readout.
- **description:** Matte-black precision clamp with polished steel disc pads and app-connected compression control. One clamp is usually enough — you'll know exactly when he's given you what you need.

Features:
- Bluetooth app: live compression readout (0–100%)
- Perpendicular steel disc jaws for even pressure
- Red/green pairing indicator
- Sold individually; pairs available for symmetrical situations

## 2. Internal research (DO NOT publish)

Story excerpts for spec mining only — never copy names, events, or dialogue into products.js:

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:4005 — do not paste into catalog -->
Izzie had a bag stuffed full of one copy of each of her standard Over Easy self defense devices (including the Sterilizer, the Ballcracker, and a matched set of StudClamps). She’d brought a second bag full of new stuff she’d just gotten today. Andrea had insisted on leaving as soon as possible and didn’t want to give Izzie the time to gather all of her stuff up. But after Izzie had explained to Andrea that Over Easy’s product line of “less than lethal” military devices was being repurposed for c…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:4299 — do not paste into catalog -->
“I just got these ones. StudClamps! Or, StudClamp, I guess. We’ll only need one for you, mister one-nut!”…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:4315 — do not paste into catalog -->
The StudClamp whirred to life, squeezing itself until his plump organ was cradled firmly between its jaws, its two concave metal discs dimpling his ball just enough to stay snugly attached. The man was starting to sweat.…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:4435 — do not paste into catalog -->
The StudClamp whirred, and its light turned green. The jaws on the cruel device slightly loosened, then squeezed again. Then, it repeated. Over and over, it loosened and clamped back down on the shattered shell that had been his only testicle.…

<!-- INTERNAL ONLY dist/andrea-and-lucas-complete/story.md:4439 — do not paste into catalog -->
Izzie kept stroking the new eunuch faster and faster, and even as his eyes rolled back, his cock started to spurt—first uneven pulses of clear precum, then an opaque belt of cum. Each time the clamp pulsed around his testicle, he twitched hard and his cumspurt swelled, as the StudClamp’s rhythmic pumping wrung every drop of semen and every chunk of nutmeat left in his scrotum out of him. She matched it pump for pump, ignoring his begging, milking his cock until the stream thinned and turned wate…

## 3. Generate product image

Use Cursor remote GenerateImage. Read logo first: `assets/brands/overeasy_logo_v2_raw_eggs_minimal.png`

**Reference images:**
- assets/brands/overeasy_logo_v2_raw_eggs_minimal.png
- assets/scenes/andrea_and_lucas/overeasy_studclamp_device_v2.png

**Prompt:**

```
Product catalog photograph of Over Easy Technologies hardware — StudClamp™.

Matte-black C-clamp control unit, steel disc jaw pads, red LED, power button on top.

BRANDING (required on every Over Easy product):
- Canonical raw-egg pictogram from logo reference: smashed raw egg left, cracked intact egg right (minimal line art — NOT smiley face, NOT fried eggs).
- Silkscreen, emboss, or print on product body/packaging beside OVER EASY TECHNOLOGIES wordmark where appropriate.

STYLE: Photo-real product photography, white or neutral studio background, sharp focus. No people, no story scenes, no characters. No on-image sound effects.

Save to: assets/scenes/andrea_and_lucas/overeasy_studclamp_device_v3.png
Use reference images when available. Never overwrite an existing file — this is a new versioned asset.
```

**Filename:** `overeasy_studclamp_device_v3.png`

## 4. Apply catalog entry

```bash
npm run oe-product -- "StudClamp™" --apply
```

Or merge `over-easy-products/drafts/studclamp/catalog-entry.json`.

## 5. Preview

http://localhost:8080/over-easy-products/#product-studclamp
