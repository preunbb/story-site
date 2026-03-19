# Content guidelines for Preun data

When adding or editing character bios and story summaries in `data/source.js`, follow these rules so the site stays spoiler-light.

---

## Character bios

- **Keep it short.** A sentence or two is enough.
- **Stick to who they are, not what happens to them.** Describe:
  - **Physical:** build, hair, style, notable traits (e.g. “Buxom blonde,” “Tall, skinny, green eyes”).
  - **Personality / role:** job, vibe, relationship to others (e.g. “Therapist. Highly competent and devoted to her clients,” “Jenny’s long-term client”).
- **Do not include:**
  - Plot outcomes (e.g. who gets castrated, who wins a fight, who dumps whom).
  - Specific acts they perform in stories (e.g. “pops his balls,” “garrotes his nut,” “stomps with a heel”).
  - Spoilers about story endings or twists.
- **Vague is fine.** “Ends up on the wrong end of Vivian’s attention” is fine; “left crumpled by Vivian’s headlock and repeated punches to the ballsack” is too specific.

---

## Story summaries

- **Describe only the setup / premise.** The first act, the hook, the “what’s the situation?”—not the resolution.
- **Do not include:**
  - Outcomes (castration, who wins, who dies, relationship endings).
  - Specific violent or sexual acts (popping, crushing, garroting, etc.).
  - Twist reveals (e.g. “She wasn’t roleplaying,” “He never had a chance”).
- **Examples of good vs bad:**
  - ✅ “Emma picks Simon up at a bar and takes him home. She ties him to her bed. She has a fantasy she wants him to play along with.”
  - ❌ “…and asks him to beg her to castrate him while she sucks him off—just a fantasy, she says. She wasn’t roleplaying.”
  - ✅ “Jenny offers to marry Sanjay if he passes a test. He has to last an hour without cumming while she uses some of Cathy’s inventions.”
  - ❌ “…and a cocksleeve that castrates him if he fails. He never had a chance.”

---

## Story `state` and `releaseDate`

- **`state`** (number): `1` = coming soon (blue “Coming soon!” badge on the grid), `2` = new (green “New story!” badge), `3` = released (no badge). Omit or use `3` for normal catalog entries.
- **`releaseDate`**: ISO date string (e.g. `"2020-01-01"`) used to sort stories on the grid within the same `state`. Stories without a date sort after dated ones in that state, then by title.

---

## Cover images

When creating or commissioning a new cover image (e.g. for a new story):

- **No text.** There must be absolutely zero text anywhere on the cover—no title, no author name, no taglines. The cover is a picture only.
- **Subject: one woman.** The cover is a photo (or photo-style image) of a single pretty woman. No men, no multiple figures, no props or scenery as the focus.
- **Match the story’s woman.** The woman on the cover must match the **physical description** of whichever female character appears most often in the story (or is the clear “lead” woman). Use that character’s bio and the story text: hair color and style, build, age range, skin tone, distinctive traits (e.g. “black hair with a streak of cyan,” “buxom blonde,” “raven-haired Asian”). The cover should look like _that_ character.
- **Match the story’s setting and tone.** Setting, outfit, and vibe should fit the story—e.g. nurse/clinical for a clinic story, domme/lingerie for a dungeon story, casual for a bar or campus story. No generic stock look; the image should feel like a still from that story’s world.

**Summary:** A text-free picture of one woman who looks like the story’s main female character, in an outfit and setting that fit the story.

---

## Reference when editing

When you add new stories or characters, create cover images, or revise existing bios/summaries, read this file (e.g. `@CONTENT-GUIDELINES.md`) and apply these rules so the catalog stays consistent and spoiler-free.
