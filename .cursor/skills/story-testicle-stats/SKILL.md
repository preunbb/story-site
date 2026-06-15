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

Update `stats/_manifest.json` (one entry per slug). Catalog chart reads from manifest at `stats/index.html`.

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

Statuses: **healthy** · **damaged** (specifics) · **popped** (who, when, how) · **popped (offscreen)**.

Every **named** male through scope. **Three Strikes only:** add `| Middle testicle |` column; Sam Johnson's row uses all three gonad columns.

Put `**Not listed:** …` and cast gaps in `notes.md`, not the main report.

### Table 2 — Pops and female orgasms

```markdown
## Pops and female orgasms

| Chapter | Testicles popped | Female orgasms |
```

(or `Section` when no chapter headings)

- **Multi-unit stories** (`sectionCount` > 1): one row per chapter/section plus a **Total** row (use `meta.json` totals; may include `+` minimums).
- **Single-unit stories** (`sectionCount` === 1): **Total row only** — no per-section breakdown.

Counting rules:
- Pop = one testicle destroyed on-page in present-timeline action
- Female orgasm = one distinct on-page female climax/squirt beat (exclude male orgasms, “she came home”, etc.)

### notes.md (required when there is commentary)

Move here (do not put in main report):

- Female orgasm review (totals, peaks, by character)
- Known narration bugs / continuity issues
- Scope, branching endings, methodology footnotes

## Catalog rollup

When asked for **overall** stats: write `stats/OVERALL.md` from all `meta.json` files; chart is at `stats/index.html`.

## Template

See `stats/andrea-lucas/testicle-stats-ch1-18.md` + `notes.md`.

## Do not

- Regex/heuristic bulk scanning instead of reading
- Edit `assets/stories/*.md`
- Add extra sections to the main report beyond the two tables
