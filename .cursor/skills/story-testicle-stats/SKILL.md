---
name: story-testicle-stats
description: Read catalog fiction and produce curated testicle-status charts, per-chapter pop counts, and female orgasm counts. Use when the user asks for ball status tables, pops per chapter, female orgasm stats, testicle tracking, or story stats for a story. Always read the prose and reason — never regex-scan or use automated CLI tools.
---

# Story testicle stats (LLM)

Produce a **curated** markdown report by reading the story yourself chapter-by-chapter (or section-by-section).

Ask the user (or infer): **which story** and **scope** (through chapter N, or full story).

## Output

Save to `stats/<slug>/`:

| File | Purpose |
|------|---------|
| `testicle-stats.md` | **Two tables only** (use `testicle-stats-ch1-<N>.md` when scope is explicit chapter range) |
| `notes.md` | Orgasm review, narration bugs, scope/methodology — not in the main report |
| `meta.json` | `{ slug, storyId, title, seriesId, sectionCount, totalPops, totalFemaleOrgasms, curated: true, generatedAt }` |

Update `stats/manifest.json` (one entry per slug; **not** `_manifest.json` — GitHub Pages/Jekyll skips underscore files). Catalog chart reads it at `stats/index.html`.

**Slug:** lowercase hyphenated title, or `series.id` when merging series parts (e.g. `andrea-lucas`).

## Prose sources

1. `assets/stories/<id>.md` (read-only; never edit)
2. Series: merge parts in `series.order` from `data/stories.js`
3. Andrea complete: `dist/andrea-and-lucas-complete/story.md` (run `npm run sync:andrea-complete` if missing)
4. Google Doc via Workspace MCP when local md missing (`user_google_email = boozlejam@gmail.com`)

## Section numbering

- If `# Chapter N:` headings exist → use those chapter numbers.
- Else → number each top-level `# Section Title` (after cast/preamble) as **1, 2, 3…** in document order.

## Report format (exactly two tables)

### Table 1 — Male testicle status

```markdown
## Male testicle status

| Male character | Left testicle | Right testicle |
```

Statuses: **healthy** · **damaged** (specifics) · **popped** (who, when, how) · **popped (offscreen)** (only when destruction happened before the story and is **not** narrated on-page).

- List every **named** male through scope.
- Also list **unnamed on-page victims** when they take pops or end-state damage that matters (e.g. arena fighters, bouncer, skit victims). Label them clearly (`Unnamed opening-fight victim`, `Unnamed male victim`).
- **Three Strikes only:** add `| Middle testicle |` column; Sam Johnson's row uses all three gonad columns.

Put cast gaps and catalog-only characters in `notes.md`, not the main report.

### Table 2 — Pops and female orgasms

```markdown
## Pops and female orgasms

| Chapter | Testicles popped | Female orgasms |
```

(or `Section` when no chapter headings)

- **Multi-unit stories** (`sectionCount` > 1): one row per chapter/section plus a **Total** row (use `meta.json` totals; may include `+` minimums).
- **Single-unit stories** (`sectionCount` === 1): **Total row only** — no per-section breakdown.

### Counting rules — pops

One **pop** = one testicle destroyed on-page in the prose (rupture, stomp, bite-through, etc.).

**Include unnamed victims in pop totals the same as named ones.** Do not relegate unnamed pops to footnotes or notes-only tallies.

**Count in the section/chapter where the prose narrates the destruction**, including:
- Flashbacks told inside a section (monologue, memory, video replay)
- Arena ring action, skits, montages — count each on-page pop even if the victim has no name

**Do not count:**
- Dream/nightmare pops (clearly framed as sleep fantasy)
- Surgical removal without a rupture “pop” moment (track as **removed (surgical)** in status table; **0 pops** in pop table)
- Events only referenced, not narrated (`popped (offscreen)` in status; **0 pops** unless the actual pop beat appears on-page somewhere in the story)
- “Almost pops” / damage that prose explicitly says did not rupture

**Do not use `popped (offscreen)`** for destruction that is fully narrated on-page in flashback — that label is for pre-story backstory only.

### Counting rules — female orgasms

One count = one distinct on-page **female** orgasm/climax/squirt beat. Exclude male orgasms and “she came to/back/home”. Count explicit “came again” / montage multiples when prose supports it.

### notes.md (required when there is commentary)

Move here (do not put in main report):

- Female orgasm review (totals, peaks, by character)
- Known narration bugs / continuity issues
- Scope, branching endings, referenced-but-not-shown events

## Catalog rollup

When asked for **overall** stats: write `stats/OVERALL.md` from all `meta.json` files; chart is at `stats/index.html`.

## Template

See `stats/andrea-lucas/testicle-stats-ch1-18.md` + `notes.md`.

## Do not

- Regex/heuristic bulk scanning instead of reading
- Edit `assets/stories/*.md`
- Add extra sections to the main report beyond the two tables
- Exclude unnamed on-page pops from Table 2 or bury them only in notes
