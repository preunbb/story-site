---
name: male-ballpain-expression
description: >-
  Prompt language for male groin-injury faces in catalog images using pain-expression
  research (FACS/IFPE) plus catalog rules. Use when generating or iterating scenes
  where a man shows testicular trauma pain, nutpain, or post-impact agony on his face.
---

# Male ballpain facial expression (image prompts)

Use this skill when a man in catalog art should read as **acute groin/testicular pain**, not generic discomfort or movie crying.

## Hard rule (repo)

**No tears** on men — no tracks, wet eyes, or cheek streaks. See `.cursor/rules/image-gen-no-male-tears.mdc`. Convey severity through **brow, eyes, mouth, jaw, pallor, sweat, posture**.

## What research says (human pain face)

Pain-expression studies (FACS summaries; *Pain* systematic review on pain-related Action Units) consistently link acute pain to a **subset** of facial actions, not one fixed “pain emoji”:

| Action (FACS-style) | What it looks like on camera |
| --- | --- |
| **AU4** — brow lowerer | Brows pulled down and toward center; deep crease between brows |
| **AU6+AU7** — cheek raise / lid tightener | Cheeks lifted; upper eyelids tense (can coexist with wide eyes in extreme pain) |
| **AU9+AU10** — nose wrinkle / upper lip raise | Nose scrunched; upper lip lifted or curled |
| **AU25–AU27** — lips part / jaw drop / mouth stretch | Mouth open or stretched; often gasping or silent scream |

Catalog **nutpain** usually pushes toward the **high-intensity** end: combine **AU4** with **very wide dry eyes** (sclera visible), **AU25–AU27**, and **AU9**, not a mild wince.

## Catalog “ballpain” look (prompt checklist)

Paste a block like this into image prompts when the beat is testicular injury, squeezes, post-class damage, or exam-room tenderness:

```
Male pain face — acute groin injury, high intensity:
- Brows lowered and knitted (AU4), deep furrow
- Eyes wide and bugging with dry sclera showing; lids tense but not squeezed shut; no tears, no wet eyes
- Nose wrinkled (AU9), upper lip slightly raised
- Mouth open in a stunned gasp or clenched-teeth grimace (AU25–AU27)
- Face pale or ashen, forehead and upper lip sweaty
- Posture: torso recoiling, chin tucked or head thrown back, shoulders hunched
- Convey nausea and shock, not theatrical movie crying
Explicit: no tears, no tear tracks, no crying wet eyes
```

### Intensity tiers

| Tier | When to use | Face |
| --- | --- | --- |
| **Mid** | Bruised nuts, lingering burn, careful palpation | Furrowed brow, tight mouth, one eye slightly wider, wince |
| **High** | Fresh squeeze, cord/epididymis pain, sample taken while sore | Full checklist above; “eyes bugging out” |
| **Collapse** | Rupture/pop aftermath | Mouth wide, unfocused stare, slack jaw, pallor; still **no tears** |

### Common mistakes (avoid in prompts and review)

- ❌ “Crying,” “tears streaming,” “tear-streaked” — filter and house style both reject this on men.
- ❌ Generic “in pain” with closed eyes only — reads as headache, not nutpain.
- ❌ Smirk or anger — ballpain is **shock + nausea**, not rage (unless story beat is both).

## Pairing with women (catalog beats)

When a woman is causing or clinically enjoying his pain:

- **Her face:** flushed, smug or satisfied smile, superior calm, lip bite, hungry eyes — contrast his chaos.
- **Composition:** tight enough that **his face** and **her reaction** share frame; viewer should read cause-and-effect.

## After generation

1. Check eyes first: wide + dry + furrowed brow reads better than closed eyes or fake tears.
2. If the model softens pain → add “high intensity AU4, eyes bugging, mouth open gasp” and bump filename version.
3. Link to `story-image-iterate` for versioning and portrait matching.

## References (for maintainers)

- Human pain face overview: lowered brows, eye tightening, nose wrinkle, mouth opening (social/biology reviews).
- FACS pain studies: consistent pain-related AUs include AU4, AU6_7, AU9_10, AU25_26_27 (*Pain* 2019 systematic review).
- IFPE manual (University of Calgary) — intensity scales for facial pain actions.