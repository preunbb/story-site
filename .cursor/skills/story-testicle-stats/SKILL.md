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
| `testicle-stats.md` | Full report (use `testicle-stats-ch1-<N>.md` when scope is explicit chapter range) |
| `meta.json` | `{ slug, storyId, title, seriesId, sectionCount, totalPops, totalFemaleOrgasms, curated: true, generatedAt }` |

Update `stats/_manifest.json` (one entry per slug).

**Slug:** lowercase hyphenated title, or `series.id` when merging series parts (e.g. `andrea-lucas`).

## Prose sources

1. `assets/stories/<id>.md` (read-only; never edit)
2. Series: merge parts in `series.order` from `data/stories.js`
3. Andrea complete: `dist/andrea-and-lucas-complete/story.md` (run `npm run sync:andrea-complete` if missing)
4. Google Doc via Workspace MCP when local md missing (`user_google_email = boozlejam@gmail.com`)

## Section numbering

- If `# Chapter N:` headings exist → use those chapter numbers.
- Else → number each top-level `# Section Title` (after cast/preamble) as **1, 2, 3…** in document order. Label tables “Section N” or “Ch.N” consistently within the report.

## Report sections (required)

### 1. Male character status (end of scope)

| Male character | Left testicle | Right testicle |

Statuses: **healthy** · **damaged** (specifics) · **popped** (who, when, how) · **popped (offscreen)**.

Every **named** male through scope. Note chars in catalog but absent from prose.

### 2. Balls popped per chapter/section

| Chapter/Section | # of testicles popped |

One count = one testicle destroyed **on-page in present-timeline action** in that unit. No flashback double-counting; no “almost pops” prose rejects.

### 3. Female orgasms per chapter/section

| Chapter/Section | # of female orgasms |

One count = one distinct on-page **female** orgasm/climax/squirt beat. Exclude male orgasms and “she came to/back/home”. Count explicit “came again” / montage multiples when prose supports it.

### 4. Female orgasm review

- Total, avg per chapter/section, peak chapter(s) with counts
- **By character** (named women; note unnamed crowds when relevant)

### 5. Known narration bugs (if any)

## Catalog rollup

When asked for **overall** stats: after per-story reports exist, write `stats/OVERALL.md` summarizing every slug from `stats/*/meta.json` plus grand totals.

## Template

See `stats/andrea-lucas/testicle-stats-ch1-18.md` for long-form layout.

## Do not

- Regex/heuristic bulk scanning instead of reading
- Edit `assets/stories/*.md`
- Skip female orgasm sections
