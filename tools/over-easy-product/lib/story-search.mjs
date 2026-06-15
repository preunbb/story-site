import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const STORY_SOURCES = [
  "dist/andrea-and-lucas-complete/story.md",
  "assets/stories/43.md",
  "assets/stories/20.md",
];

/**
 * @param {string} repoRoot
 * @param {string} productName
 * @param {{ maxExcerpts?: number }} [opts]
 */
export function searchStoryForProduct(repoRoot, productName, opts = {}) {
  const maxExcerpts = opts.maxExcerpts ?? 8;
  const terms = buildSearchTerms(productName);
  const hits = [];

  for (const rel of STORY_SOURCES) {
    const path = join(repoRoot, rel);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    const lines = text.split("\n");
    const paragraphs = extractParagraphs(lines);

    for (const para of paragraphs) {
      const score = scoreParagraph(para.text, terms);
      if (score <= 0) continue;
      hits.push({
        source: rel,
        lineStart: para.lineStart,
        lineEnd: para.lineEnd,
        score,
        text: para.text.trim(),
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, maxExcerpts);
}

/** @param {string} productName */
function buildSearchTerms(productName) {
  const base = productName.replace(/™|®/g, "").trim();
  const lower = base.toLowerCase();
  const terms = new Set([lower, lower.replace(/\s+/g, " ")]);

  // "Ball Killers" → ball killer, ball killers
  if (lower.endsWith("s")) terms.add(lower.slice(0, -1));
  terms.add(lower.replace(/\s+/g, "-"));

  // Over Easy spellings
  for (const t of [...terms]) {
    if (t.includes("over easy")) terms.add(t.replace("over easy", "overeasy"));
  }

  return [...terms].filter((t) => t.length >= 3);
}

/** @param {string[]} lines */
function extractParagraphs(lines) {
  /** @type {{ text: string, lineStart: number, lineEnd: number }[]} */
  const out = [];
  let buf = [];
  let start = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      if (buf.length) {
        out.push({
          text: buf.join("\n"),
          lineStart: start,
          lineEnd: i,
        });
        buf = [];
      }
      continue;
    }
    if (!buf.length) start = i + 1;
    buf.push(line);
  }
  if (buf.length) {
    out.push({ text: buf.join("\n"), lineStart: start, lineEnd: lines.length });
  }
  return out;
}

/** @param {string} text @param {string[]} terms */
function scoreParagraph(text, terms) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) score += term.length;
  }
  if (/over easy|overeasy/i.test(text) && score > 0) score += 5;
  return score;
}
