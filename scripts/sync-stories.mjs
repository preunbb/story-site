#!/usr/bin/env node
/*
 * Pulls every story listed in data/stories.js from its published Google Doc
 * URL, extracts the document body, converts it to Markdown, and writes it to
 * assets/stories/<id>.md. Run via `npm run sync` whenever a story's source
 * Google Doc has been edited.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createContext, Script } from "node:vm";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

const STORIES_JS = join(repoRoot, "data", "stories.js");
const OUT_DIR = join(repoRoot, "assets", "stories");
const ARGS = parseArgs(process.argv.slice(2));

function parseIdList(raw) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (Number.isFinite(Number(s)) ? Number(s) : s));
}

function parseArgs(argv) {
  const out = { concurrency: 3, only: null, prune: true };
  const positional = [];
  for (const arg of argv) {
    if (arg.startsWith("--concurrency=")) {
      const n = parseInt(arg.slice("--concurrency=".length), 10);
      if (Number.isFinite(n) && n > 0) out.concurrency = Math.min(n, 8);
    } else if (arg.startsWith("--only=")) {
      out.only = new Set(parseIdList(arg.slice("--only=".length)));
    } else if (arg === "--no-prune") {
      out.prune = false;
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }
  // Treat any positional args as a comma-separated list of story ids, e.g.
  // `npm run sync 42,43,1` or `npm run sync 42 43 1`.
  if (!out.only && positional.length) {
    out.only = new Set(parseIdList(positional.join(",")));
  }
  return out;
}

function loadStories() {
  const code = readFileSync(STORIES_JS, "utf8");
  const sandbox = { window: {} };
  createContext(sandbox);
  new Script(code, { filename: "data/stories.js" }).runInContext(sandbox);
  const stories = sandbox.window.DATA_STORIES;
  if (!Array.isArray(stories)) {
    throw new Error("data/stories.js did not populate window.DATA_STORIES");
  }
  return stories;
}

function makeTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    hr: "---",
    codeBlockStyle: "fenced",
    linkStyle: "inlined",
  });
  // Drop images: stories shouldn't include any, and we don't want broken refs.
  td.addRule("dropImages", { filter: "img", replacement: () => "" });
  // Disable turndown's aggressive backslash-escaping. The site's renderer in
  // script.js is conservative (emphasis only with whitespace flanks; headings
  // only at block start) so leaving underscores/asterisks/hyphens unescaped is
  // safe and avoids visible "\_" / "\-" leaking into prose like email
  // addresses and divider rows.
  td.escape = (s) => s;
  return td;
}

/**
 * Builds a map of CSS-class → {italic,bold} from every <style> block in the
 * document. Google Docs encodes inline emphasis as `<span class="cN">…</span>`
 * where `cN` is defined in a <style> block as `font-style:italic` and/or
 * `font-weight:bold` (or numeric ≥600). Without this, turndown can't see the
 * formatting and italics/bolds get silently lost during conversion.
 */
function parseStyleClassFormatting($) {
  const map = new Map();
  const ruleRe = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
  $("style").each((_, el) => {
    const css = $(el).contents().text();
    let m;
    while ((m = ruleRe.exec(css))) {
      const name = m[1];
      const decl = m[2];
      const flags = map.get(name) || { italic: false, bold: false };
      if (/font-style\s*:\s*italic/i.test(decl)) flags.italic = true;
      if (/font-weight\s*:\s*(?:bold|bolder|[6-9]00)\b/i.test(decl)) {
        flags.bold = true;
      }
      map.set(name, flags);
    }
    ruleRe.lastIndex = 0;
  });
  return map;
}

function inlineStyleFormatting(styleAttr) {
  if (!styleAttr) return null;
  const flags = { italic: false, bold: false };
  if (/font-style\s*:\s*italic/i.test(styleAttr)) flags.italic = true;
  if (/font-weight\s*:\s*(?:bold|bolder|[6-9]00)\b/i.test(styleAttr)) {
    flags.bold = true;
  }
  return flags.italic || flags.bold ? flags : null;
}

/**
 * Replaces visually-formatted spans/paragraphs with real <em>/<strong> tags
 * so turndown produces proper markdown. Mutates `body` in place.
 */
function wrapStyledFormatting($, body, classFormatting) {
  body.find("[class],[style]").each((_, el) => {
    const $el = $(el);
    const flags = { italic: false, bold: false };
    const classes = ($el.attr("class") || "").split(/\s+/).filter(Boolean);
    for (const cls of classes) {
      const f = classFormatting.get(cls);
      if (!f) continue;
      if (f.italic) flags.italic = true;
      if (f.bold) flags.bold = true;
    }
    const inline = inlineStyleFormatting($el.attr("style"));
    if (inline) {
      flags.italic = flags.italic || inline.italic;
      flags.bold = flags.bold || inline.bold;
    }
    if (!flags.italic && !flags.bold) return;
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    // Skip headings — turndown handles their text fine, and wrapping inside
    // would produce e.g. `# *Heading*` which our renderer would parse oddly.
    if (/^h[1-6]$/.test(tag)) return;
    let inner = $el.html() || "";
    if (!inner.trim()) return;
    if (flags.italic) inner = `<em>${inner}</em>`;
    if (flags.bold) inner = `<strong>${inner}</strong>`;
    $el.html(inner);
  });
}

/**
 * Google Docs wraps every external link in a
 *   https://www.google.com/url?q=<real-url>&sa=D&source=editors&ust=…&usg=…
 * tracking redirector. Strip it back to the actual destination.
 */
function unwrapGoogleRedirectorHref(href) {
  if (!href || typeof href !== "string") return href;
  if (!/^https?:\/\/(?:www\.)?google\.com\/url\?/i.test(href)) return href;
  try {
    const u = new URL(href);
    const q = u.searchParams.get("q");
    return q || href;
  } catch {
    return href;
  }
}

function unwrapAllGoogleRedirectors($, body) {
  body.find("a[href]").each((_, el) => {
    const $el = $(el);
    const orig = $el.attr("href");
    const cleaned = unwrapGoogleRedirectorHref(orig);
    if (cleaned !== orig) $el.attr("href", cleaned);
    // Also rewrite link text if it visibly displays the redirector URL
    // (Google Docs sometimes uses the full URL as the anchor text).
    const text = $el.text();
    if (text && text.trim() === orig) $el.text(cleaned);
  });
}

/**
 * Authors mark scene/chapter breaks by typing rows of dashes (or asterisks /
 * underscores) on their own line. In the published HTML these are just plain
 * paragraphs like `<p><span>------</span></p>`. Convert them to real <hr>
 * elements so turndown emits a proper markdown HR (---) and the renderer can
 * style them as visual dividers.
 */
function convertDashDividersToHr($, body) {
  // Allow ASCII -, *, _ as well as the typographic en/em dashes. Authors here
  // use anything from a single "-" to long "------" rows as scene breaks; a
  // standalone dash-character paragraph is essentially never anything else.
  const dividerRe = /^[-*_\u2013\u2014]+$/;
  body.find("p").each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, "");
    if (text && dividerRe.test(text)) {
      $el.replaceWith("<hr />");
    }
  });
}

function extractBodyHtml(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const body = $(".doc-content").first();
  if (!body.length) return null;
  const classFormatting = parseStyleClassFormatting($);
  wrapStyledFormatting($, body, classFormatting);
  unwrapAllGoogleRedirectors($, body);
  convertDashDividersToHr($, body);
  // Strip empty spans/paragraphs that Google emits as visual padding.
  body.find("p").each((_, el) => {
    const $el = $(el);
    if (!$el.text().trim() && !$el.find("img,br").length) $el.remove();
  });
  body.find("span").each((_, el) => {
    const $el = $(el);
    if (!$el.attr("href") && !$el.text().length) $el.remove();
  });
  return body.html() || "";
}

function postProcessMarkdown(md) {
  return (
    md
      // Published Docs HTML sometimes merges a scene tag paragraph with the next
      // line into one markdown line, so `storyMarkdownToSafeHtml` never sees a
      // block that is only `[[scene:…]]`. Split when glued: `[[scene:x]] Next…`
      .replace(/^(\[\[scene:[^\]]+\]\]) +(\S.*)$/gm, "$1\n\n$2")
      // Docs emphasis can wrap the scene tag in `*…*`; strip that so it matches
      // SCENE_TAG_BLOCK_RE.
      .replace(/^\*\[\[scene:([^\]]+)\]\]\*$/gm, "[[scene:$1]]")
      // Collapse 3+ blank lines into 2.
      .replace(/\n{3,}/g, "\n\n")
      // Trim trailing whitespace per line (turndown sometimes leaves "  ").
      .replace(/[ \t]+$/gm, "")
      .trim() + "\n"
  );
}

/**
 * Counts words the same way `wc -w` does: any run of non-whitespace is one
 * word. Matches Google Docs' built-in word count closely enough that the
 * existing hand-entered values in data/stories.js round-trip exactly.
 */
function countWords(md) {
  const trimmed = md.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Updates the `wordCount` field for the given story ids in data/stories.js.
 *
 * `updates` is an array of `{ id, words, fullLengthNovel }`. For each entry:
 *   - If the matching block already has a `wordCount: N,` line, replace it.
 *   - If it doesn't and the story is not a full-length novel, insert one
 *     directly after the `id: N,` line.
 *   - Full-length novels with no existing wordCount field are left alone
 *     (the UI bypasses wordCount for them anyway).
 *
 * Top-level story blocks are detected as line-exact `  {` ... `  },` pairs at
 * indent 2 (matching the file's existing style). When the same id appears in
 * multiple blocks (e.g. id 43 has both a Part 1 and Part 2 entry), the block
 * containing a `driveUrl:` line is preferred — that's the one we actually
 * just synced from.
 *
 * Returns one result per requested update describing what happened.
 */
function applyWordCountUpdates(filepath, updates) {
  if (!updates.length) return [];
  const content = readFileSync(filepath, "utf8");
  const lines = content.split("\n");

  const findBlocks = () => {
    const blocks = [];
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (start === -1) {
        if (line === "  {") start = i;
      } else if (line === "  }," || line === "  }") {
        blocks.push({ start, end: i });
        start = -1;
      }
    }
    return blocks;
  };

  const ID_RE = /^    id:\s+(\d+),\s*$/;
  const WC_RE = /^    wordCount:\s+(\d+),\s*$/;
  const DRIVE_RE = /^    driveUrl:/;

  const results = [];
  let dirty = false;

  for (const { id, words, fullLengthNovel } of updates) {
    const blocks = findBlocks();
    const matches = [];
    for (const blk of blocks) {
      for (let i = blk.start; i <= blk.end; i++) {
        const m = lines[i].match(ID_RE);
        if (m && Number(m[1]) === id) {
          matches.push(blk);
          break;
        }
      }
    }
    if (!matches.length) {
      results.push({ id, status: "block-not-found", words });
      continue;
    }
    let target = matches[0];
    if (matches.length > 1) {
      const withDrive = matches.filter((blk) =>
        lines.slice(blk.start, blk.end + 1).some((l) => DRIVE_RE.test(l)),
      );
      if (withDrive.length) target = withDrive[0];
    }

    let wcIdx = -1;
    for (let i = target.start; i <= target.end; i++) {
      if (WC_RE.test(lines[i])) {
        wcIdx = i;
        break;
      }
    }

    const newLine = `    wordCount: ${words},`;
    if (wcIdx !== -1) {
      const oldWords = Number(lines[wcIdx].match(WC_RE)[1]);
      if (oldWords === words) {
        results.push({ id, status: "unchanged", words });
        continue;
      }
      lines[wcIdx] = newLine;
      dirty = true;
      results.push({ id, status: "updated", words, from: oldWords });
      continue;
    }

    if (fullLengthNovel) {
      results.push({ id, status: "skipped-novel", words });
      continue;
    }

    let idIdx = -1;
    for (let i = target.start; i <= target.end; i++) {
      if (ID_RE.test(lines[i])) {
        idIdx = i;
        break;
      }
    }
    if (idIdx === -1) {
      results.push({ id, status: "id-line-not-found", words });
      continue;
    }
    lines.splice(idIdx + 1, 0, newLine);
    dirty = true;
    results.push({ id, status: "added", words });
  }

  if (dirty) writeFileSync(filepath, lines.join("\n"), "utf8");
  return results;
}

async function fetchDoc(url, attempt = 1) {
  const res = await fetch(url, { redirect: "follow" });
  if (res.status === 429 || res.status >= 500) {
    if (attempt < 4) {
      const wait = 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, wait));
      return fetchDoc(url, attempt + 1);
    }
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function syncOne(story, td) {
  if (!story.driveUrl) return { id: story.id, skipped: "no driveUrl" };
  const html = await fetchDoc(story.driveUrl);
  const inner = extractBodyHtml(html);
  if (inner == null) throw new Error("could not find .doc-content");
  if (!inner.trim()) throw new Error(".doc-content was empty");
  const md = postProcessMarkdown(td.turndown(inner));
  const outPath = join(OUT_DIR, `${story.id}.md`);
  writeFileSync(outPath, md, "utf8");
  return {
    id: story.id,
    bytes: md.length,
    words: countWords(md),
    title: story.title,
  };
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        results[i] = { error: err.message, item: items[i] };
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, next);
  await Promise.all(workers);
  return results;
}

function pruneOrphans(validIds) {
  if (!existsSync(OUT_DIR)) return [];
  const removed = [];
  for (const f of readdirSync(OUT_DIR)) {
    if (!f.endsWith(".md")) continue;
    const id = f.slice(0, -3);
    const idNum = Number(id);
    const key = Number.isFinite(idNum) && String(idNum) === id ? idNum : id;
    if (!validIds.has(key)) {
      unlinkSync(join(OUT_DIR, f));
      removed.push(f);
    }
  }
  return removed;
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const all = loadStories();
  const stories = ARGS.only
    ? all.filter((s) => ARGS.only.has(s.id))
    : all.filter((s) => s.driveUrl);
  if (!stories.length) {
    console.error("No matching stories to sync.");
    process.exit(1);
  }
  console.log(
    `Syncing ${stories.length} stories (concurrency=${ARGS.concurrency})...`,
  );

  const td = makeTurndown();
  const t0 = Date.now();
  const results = await runWithConcurrency(stories, ARGS.concurrency, (s) =>
    syncOne(s, td),
  );

  const ok = [];
  const errs = [];
  const wcUpdates = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const s = stories[i];
    if (r.error) {
      errs.push({ id: s.id, title: s.title, error: r.error });
      console.error(`  FAIL  #${s.id} "${s.title}": ${r.error}`);
    } else if (r.skipped) {
      console.log(`  SKIP  #${s.id}: ${r.skipped}`);
    } else {
      ok.push(r);
      console.log(
        `  ok    #${s.id} "${s.title}" (${r.bytes} bytes, ${r.words} words)`,
      );
      wcUpdates.push({
        id: s.id,
        words: r.words,
        fullLengthNovel: !!s.fullLengthNovel,
      });
    }
  }

  const wcResults = applyWordCountUpdates(STORIES_JS, wcUpdates);
  for (const r of wcResults) {
    if (r.status === "updated") {
      console.log(`  wc    #${r.id}: ${r.from} -> ${r.words}`);
    } else if (r.status === "added") {
      console.log(`  wc    #${r.id}: added ${r.words}`);
    } else if (r.status === "skipped-novel") {
      // No-op for full-length novels with no existing field.
    } else if (r.status === "unchanged") {
      // No-op when the count didn't move.
    } else {
      console.warn(`  wc    #${r.id}: ${r.status}`);
    }
  }

  let pruned = [];
  if (ARGS.prune && !ARGS.only) {
    const validIds = new Set(all.map((s) => s.id));
    pruned = pruneOrphans(validIds);
    for (const f of pruned) console.log(`  prune ${f}`);
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\nDone in ${dt}s: ${ok.length} ok, ${errs.length} errors${
      pruned.length ? `, ${pruned.length} pruned` : ""
    }.`,
  );
  if (errs.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
