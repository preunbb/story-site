---
name: story-copy-edit
description: >-
  Spellcheck and grammar-check catalog fiction without "correcting" intentional
  vocabulary or rewriting voice. Use when the user asks for a copy edit, typo
  pass, proofread, spellcheck, or grammar check on story prose.
---

# Story copy-edit

Apply project vocabulary and style rules from `.cursor/rules/copy-edit-spellchecker.mdc` (always in effect). This skill adds **workflow** and **output format** for a careful pass.

## What to fix

- Objective typos, doubled words, wrong apostrophes
- Subject–verb agreement, tense slips, missing words
- Style preferences in the rule (okay, liquify, Church, Goddess, step-sister, numbers ≤ 10, etc.)

## What not to "fix"

- Catalog lexicon: halfstration, nutmeat, nutpain, ballpain, ballache, ballsack, testeria, *star* (casting), *drinks get drank*, hoorah
- Author voice, rhythm, or deliberate colloquialism
- Structural or plot issues → use `story-structural-review` instead

## Where prose lives

| Task | Edit here | Read here |
|------|-----------|-----------|
| Published catalog story | Google Doc (via `dist/drive_doc_ids.json` + Google Workspace MCP) | `assets/stories/<id>.md` read-only |
| Local draft | File author specifies | Same |

**Never edit `assets/stories/*.md` for published stories** — sync overwrites it.

## Workflow

1. **Identify story** — `data/stories.js` id/title, or path user gave.
2. **Load text** — synced markdown or Drive doc.
3. **First pass — mechanical** — typos, doubled words, punctuation.
4. **Second pass — grammar** — agreement, tense, parallel structure.
5. **Third pass — style rule** — apply preferences from copy-edit-spellchecker rule only.
6. **Deliver report** — use format below.
7. **Apply fixes** — only if user asked to implement; Drive doc via MCP, never synced `.md` for published tales.

## Severity

- **Error** — wrong word, typo, clear grammar mistake
- **Style** — preference mismatch (okay vs ok, Church capitalization)
- **Query** — might be intentional catalog term or voice; ask or leave alone

## Report format

```markdown
# Copy-edit: [Story title]

**Scope:** [full / chapters / section]
**Fixes applied:** [yes / no — report only]

## Errors
| Location | Original | Suggested | Note |
|----------|----------|-----------|------|

## Style
| Location | Original | Suggested | Rule |
|----------|----------|-----------|------|

## Queries (left unchanged)
| Location | Text | Reason |
|----------|------|--------|

## Summary
[N counts: errors, style, queries]
```

When applying fixes in Drive, batch related edits; do not rephrase beyond what is needed to fix the issue.

## Tools

- Local UI (optional): `npm run copy-edit-server` under `tools/copy-edit-server/`
- Sync after Drive edits: `npm run sync` or `scripts/sync-stories.mjs`
