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

function parseArgs(argv) {
  const out = { concurrency: 3, only: null, prune: true };
  for (const arg of argv) {
    if (arg.startsWith("--concurrency=")) {
      const n = parseInt(arg.slice("--concurrency=".length), 10);
      if (Number.isFinite(n) && n > 0) out.concurrency = Math.min(n, 8);
    } else if (arg.startsWith("--only=")) {
      const ids = arg
        .slice("--only=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (Number.isFinite(Number(s)) ? Number(s) : s));
      out.only = new Set(ids);
    } else if (arg === "--no-prune") {
      out.prune = false;
    }
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
  // Drop horizontal rules originating from Google's chrome page-breaks.
  td.addRule("dropHr", { filter: "hr", replacement: () => "" });
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

function extractBodyHtml(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const body = $(".doc-content").first();
  if (!body.length) return null;
  const classFormatting = parseStyleClassFormatting($);
  wrapStyledFormatting($, body, classFormatting);
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
      // Collapse 3+ blank lines into 2.
      .replace(/\n{3,}/g, "\n\n")
      // Trim trailing whitespace per line (turndown sometimes leaves "  ").
      .replace(/[ \t]+$/gm, "")
      .trim() + "\n"
  );
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
  return { id: story.id, bytes: md.length, title: story.title };
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
      console.log(`  ok    #${s.id} "${s.title}" (${r.bytes} bytes)`);
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
