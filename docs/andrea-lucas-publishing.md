# Andrea & Lucas — publishing plan

Living plan for shipping the **unpublished** portion of *Andrea and Lucas* across Amazon and Ko-fi. Use this doc when regenerating export bundles after Google Doc edits.

---

## Distribution split

| Channel | Role |
|---------|------|
| **Amazon (KDP)** | Commercial storefront. Prefer **text-only** interiors (no inline scene images) to reduce content-review risk. Upload cover JPEG separately. |
| **Ko-fi** | Direct reader distribution. Can offer **illustrated** variants (inline scene images) alongside text-only. |

**Already published** (both channels): everything **through and including the Interlude** — Chapters 1–7 plus the Interlude.

**Not yet published** (this plan): **Part 2** (Chapter 8 onward) and optionally a **complete** edition bundling the full manuscript.

---

## Editions to ship

### 1. Part 2 — *Andrea and Lucas: Part 2* (unpublished continuation)

- **Scope:** `# Chapter 8: Cherry Pop!` through `# Epilogue` (end of manuscript).
- **Subtitle on title page:** `Part 2` (or `Premium continuation — Part 2.` to match catalog copy).
- **Cover:** existing Part 2 artwork — `assets/covers/andrea_and_lucas_part_2_cover_eve_abby_kay_v1.png` (catalog id **47**).
- **Variants:**
  - `part-2.pdf` — text-only (Amazon / safe KDP interior)
  - `part-2-illustrated.pdf` — inline scene images (Ko-fi)
  - `part-2.epub` — text-only EPUB (Amazon / KDP reflowable upload; scene images stripped)

### 2. Complete — full manuscript

- **Scope:** entire `dist/andrea-and-lucas-complete/story.md` (Chapters 1–24, Interlude, Epilogue).
- **Title:** `Andrea and Lucas`
- **Cover:** **TBD — needs a new cover.** Candidates to evaluate:
  - `assets/covers/andrea_and_lucas.png` (Part 1 / legacy)
  - `assets/covers/andrea_and_lucas_cherry_pop_concert_cover_sfw_v*.png`
  - `assets/covers/andrea_and_lucas_church_broken_tree_cover_sfw_v*.png`
  - Or generate a new composite / updated artwork that reads as “complete novel” rather than Part 1 or Part 2.
- **Variants:**
  - `complete.pdf` — text-only
  - `complete-illustrated.pdf` — inline scene images

---

## One-click publish bundle (implemented)

**Script:** `scripts/publish-andrea-lucas.mjs`  
**npm:** `npm run publish:andrea-lucas`

### Prerequisites

1. `.env.local` configured with `ANDREA_LUCAS_EDIT_DOC_ID` and `ANDREA_LUCAS_PUBLISH_URL` (see `.env.local.example`).
2. Sync the canonical Google Doc into the repo:
   ```bash
   npm run sync:andrea-complete
   ```
3. Google Chrome installed (headless PDF print).
4. `.venv-crop` Python venv available (for `make_cover.py` / Pillow).

### What it generates

All outputs land in **`dist/andrea-lucas-published/`** (under `dist/`, which is **gitignored** — PDFs, EPUBs, and cover JPEGs are never committed).

| Output file | Edition | Images | Channel notes |
|-------------|---------|--------|---------------|
| `part-2.pdf` | Ch. 8 → Epilogue | stripped | Amazon KDP interior |
| `part-2-illustrated.pdf` | Ch. 8 → Epilogue | embedded | Ko-fi |
| `part-2.epub` | Ch. 8 → Epilogue | stripped | Amazon KDP reflowable |
| `complete.pdf` | full manuscript | stripped | Amazon |
| `complete-illustrated.pdf` | full manuscript | embedded | Ko-fi |
| `covers/part-2.jpg` | Part 2 listing art | n/a | KDP / Ko-fi cover upload |
| `covers/complete.jpg` | Complete listing art | n/a | KDP / Ko-fi cover upload |

Also writes `manifest.json` with generation timestamp, source path, word counts, and cover paths.

### Regeneration workflow

Expect to rerun often while the Google Doc is still being edited:

```bash
npm run sync:andrea-complete      # pull latest prose from Google Doc
npm run publish:andrea-lucas      # rebuild PDFs, Part 2 EPUB, and cover JPEGs
```

Optional flags (see script header): `--skip-sync` if you already synced, `--end-page` to append the standard “Until next time” back matter to PDF interiors.

---

## Covers (storefront JPEGs — title + author required)

KDP and Ko-fi listing covers are **separate JPEGs**, not baked into PDF/EPUB interiors. Every cover **must** show:

1. **Title** — top margin, Optima, candlelit ivory (e.g. `Andrea and Lucas: Part 2` or `Andrea and Lucas`)
2. **Author** — bottom margin, `by Preun BB` (this is the default in `scripts/make_cover.py`; do not omit or shorten)

Generate via `make_cover.py` (already implements both lines):

```bash
# Part 2 cover (story id 47 — artwork source)
.venv-crop/bin/python3 scripts/make_cover.py 47 \
  --title "Andrea and Lucas: Part 2" \
  -o dist/andrea-lucas-published/covers/part-2.jpg

# Complete cover — once artwork is chosen (story id 43, custom title)
.venv-crop/bin/python3 scripts/make_cover.py 43 \
  --title "Andrea and Lucas" \
  -o dist/andrea-lucas-published/covers/complete.jpg
```

`make_cover.py` never overwrites artwork; it extends the canvas to KDP minimum dimensions and overlays **title + author** in the standard dark-margin style. The `--title` flag overrides the catalog title string only — author stays `by Preun BB` unless we explicitly add a flag later.

**Publish script requirement:** `publish-andrea-lucas.mjs` should call `make_cover.py` for both covers on every run so regenerated bundles always ship matching listing art with correct title/author typography.

> **TODO:** pick final complete-edition cover **artwork** (the PNG under `assets/covers/`). Title and author overlay are handled by `make_cover.py` regardless of which PNG is chosen. May require a `--cover=` flag on `make_cover.py` if the chosen art isn't the default `data/stories.js` cover for id 43.

**EPUB note:** Part 2 text-only EPUB is built **without** an embedded cover page (`--no-cover`); upload `covers/part-2.jpg` separately to KDP the same way as PDF. If we later want the JPEG baked into the EPUB, pass the generated cover path into the EPUB renderer.

**PDF interior title pages** currently show title + subtitle only (no author line). That's fine for print-style interiors; the **storefront cover JPEG** is where title + `by Preun BB` must appear.

---

## Source of truth

| What | Where |
|------|-------|
| **Canonical prose** | Google Doc (`ANDREA_LUCAS_EDIT_DOC_ID` in `.env.local`) |
| **Local snapshot** | `dist/andrea-and-lucas-complete/story.md` (via `npm run sync:andrea-complete`) |
| **Scene image registry** | `data/stories.js` — Part 1 scenes (id **43**) + Part 2 scenes (id **47**, currently mostly commented out) merged via `mergeAndreaLucasStory()` |
| **Catalog story id for full export** | **43** — `render-story-pdf.mjs` also reads the complete manuscript when passed id 43 |

**Do not** use `assets/stories/43.md` or `47.md` for these bundles; those are per-part Drive syncs and may lag the complete doc.

---

## Chapter boundaries (reference)

Headings in the synced complete markdown (as of last sync):

```
Chapters 1–7
Interlude
Chapters 8–24
Epilogue
```

**Published cutoff:** end of Interlude.  
**Part 2 export cutoff:** start at `# Chapter 8: Cherry Pop!`, include everything through `# Epilogue`.

---

## Illustrated vs text-only — scene pipeline

- **Text-only:** `[[scene:…]]` tags are silently stripped (same as EPUB `--no-images`).
- **Illustrated:** tags resolve against `mergeAndreaLucasStory()` scene list; each match becomes an inline `<figure>` in the PDF.

**Current gap:** the complete Google Doc snapshot may not yet contain `[[scene:…]]` tags (or Part 2 scenes may still be commented out in `data/stories.js`). In that case illustrated and text-only PDFs will be **identical** until:

1. Scene tags are inserted in the Google Doc at the correct beats, and
2. Part 2 scene entries are registered in `data/stories.js`.

---

## Future work (not in scope yet)

- [ ] **EPUB variants** for Complete edition (text-only + illustrated).
- [ ] **`--cover=` flag** on `make_cover.py` if complete-edition artwork isn't the default stories.js cover for id 43.
- [ ] **Final complete cover artwork** — choose or commission the underlying PNG (title/author overlay is already solved by `make_cover.py`).
- [ ] **Amazon vs Ko-fi upload checklist** (pricing, descriptions, illustrated Ko-fi-only links).
- [ ] **Scene tag pass** on the Google Doc so illustrated PDFs actually embed art.
- [ ] Uncomment / add Part 2 `scenes` entries in `data/stories.js` (id 47 currently has `hideScenes: true` and commented scene list).
- [ ] Decide whether Chapters 21–22 (outline placeholders per stats notes) ship in v1 or get held back.

### Publish script implementation checklist

- [ ] `scripts/publish-andrea-lucas.mjs` — orchestrate sync (optional), four PDFs, Part 2 text-only EPUB, two cover JPEGs, `manifest.json`
- [ ] EPUB slice helper — render `extractFromChapter(md, 8)` through existing EPUB pipeline with `--no-images --no-cover`
- [ ] Wire `make_cover.py` for `covers/part-2.jpg` and `covers/complete.jpg` on every run

---

## Related scripts

| Script | Purpose |
|--------|---------|
| `npm run sync:andrea-complete` | Pull Google Doc → `dist/andrea-and-lucas-complete/story.md` |
| `npm run publish:andrea-lucas` | **One-click publish bundle** → `dist/andrea-lucas-published/` (4 PDFs + Part 2 EPUB + covers) |
| `npm run pdf -- 43` | Dual PDF for full story via generic renderer (outputs to `dist/andrea-and-lucas*.pdf`, not the publish folder) |
| `npm run pdf:andrea-part-1` | Legacy Part 1 only (ch 1–7 + interlude) |
| `scripts/publish.mjs` | Generic per-story cover + EPUB + PDF (not Andrea-specific slicing) |

---

## Quick checklist before upload

1. [ ] `npm run sync:andrea-complete`
2. [ ] `npm run publish:andrea-lucas`
3. [ ] Spot-check all four PDFs + `part-2.epub` in `dist/andrea-lucas-published/`
4. [ ] Verify cover JPEGs show **title + `by Preun BB`** in `dist/andrea-lucas-published/covers/`
5. [ ] Amazon: upload text-only interiors (`part-2.pdf` or `part-2.epub`) + cover JPEG
6. [ ] Ko-fi: offer illustrated PDF variants where appropriate
