#!/usr/bin/env node
/*
 * Render a chapter range from dist/andrea-and-lucas-complete/story.md to PDF.
 *
 * Usage:
 *   node scripts/render-andrea-complete-chapters-pdf.mjs [--from=8] [--to=10]
 *     [--out=dist/andrea-and-lucas-complete/chapters-8-10.pdf]
 *     [--include-interlude] [--end-page]
 *
 * Presets:
 *   --part=1   Chapters 1–7, interlude, scene images, END_PAGE back matter
 *              -> dist/andrea-and-lucas-complete/part-1.pdf
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  storyMarkdownToSafeHtml,
  extractChapters,
  escapeHtml,
  DEFAULT_OUT_DIR,
  mergeAndreaLucasStory,
  makePdfSceneRenderer,
  PDF_SCENE_FIGURE_CSS,
  PDF_END_PAGE_CSS,
  PDF_PRINT_PALETTE,
  buildEndPageHtml,
  loadStories,
} from "./lib/story-render.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const STORY_MD = join(REPO_ROOT, "dist", "andrea-and-lucas-complete", "story.md");

const READER_OPTS = {
  linkClass: "story-reader-inline-link",
  dividerClass: "story-reader-divider",
};

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function parseArgs(argv) {
  const out = {
    from: 8,
    to: 10,
    output: null,
    includeInterlude: false,
    endPage: false,
    part: null,
  };
  for (const arg of argv) {
    if (arg === "--include-interlude") out.includeInterlude = true;
    else if (arg === "--end-page") out.endPage = true;
    else if (arg === "--part=1") {
      out.part = 1;
      out.from = 1;
      out.to = 7;
      out.includeInterlude = true;
      out.endPage = true;
    } else if (arg.startsWith("--from=")) {
      out.from = Number(arg.slice("--from=".length));
    } else if (arg.startsWith("--to=")) {
      out.to = Number(arg.slice("--to=".length));
    } else if (arg.startsWith("--out=")) {
      out.output = arg.slice("--out=".length);
    }
  }
  return out;
}

function findChrome() {
  for (const path of CHROME_CANDIDATES) {
    try {
      readFileSync(path);
      return path;
    } catch {
      /* not present */
    }
  }
  throw new Error(
    "Could not find Google Chrome / Chromium. Install Chrome or set CHROME_BIN.",
  );
}

function extractChapterRange(markdown, from, to, { includeInterlude = false } = {}) {
  const matches = [...markdown.matchAll(/^# Chapter (\d+):[^\n]*/gm)];
  const start = matches.find((m) => Number(m[1]) === from);
  if (!start) {
    throw new Error(`Chapter ${from} not found in ${STORY_MD}`);
  }

  let endIdx;
  if (includeInterlude) {
    const after = matches.find((m) => Number(m[1]) === to + 1);
    endIdx = after ? after.index : markdown.length;
  } else {
    const end = matches.find((m) => Number(m[1]) === to + 1);
    endIdx = end ? end.index : markdown.length;
  }

  return markdown.slice(start.index, endIdx).trim() + "\n";
}

function buildTitlePageHtml({ title, subtitle }) {
  const { ink, inkMuted } = PDF_PRINT_PALETTE;
  return `  <section class="title-page">
    <h1 class="title-main">${escapeHtml(title)}</h1>
    <p class="title-sub">${escapeHtml(subtitle)}</p>
  </section>
  <style>
    .title-page {
      page-break-after: always;
      text-align: center;
      padding-top: 2.5in;
    }
    .title-page .title-main {
      font-size: 26pt;
      font-weight: 700;
      margin: 0 0 0.25in;
      color: ${ink};
      letter-spacing: 0.01em;
    }
    .title-page .title-sub {
      font-size: 14pt;
      color: ${inkMuted};
      margin: 0;
      letter-spacing: 0.04em;
    }
  </style>`;
}

function buildHtmlDocument({ title, subtitle, bodyHtml, endPage }) {
  const palette = PDF_PRINT_PALETTE;
  const titlePage = buildTitlePageHtml({ title, subtitle });
  const endHtml = endPage ? buildEndPageHtml() : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)} — ${escapeHtml(subtitle)}</title>
<style>
  @page { size: Letter; margin: 0.85in 0.75in; }
  :root {
    --bg: ${palette.bg};
    --ink: ${palette.ink};
    --ink-muted: ${palette.inkMuted};
    --red: ${palette.red};
    --red-bright: ${palette.redBright};
    --red-dim: ${palette.redDim};
  }
  html, body {
    margin: 0; padding: 0;
    background: var(--bg); color: var(--ink);
    font-family: "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 11pt; line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  article.story-reader-article {
    max-width: 6.25in; margin: 0 auto; color: var(--ink);
  }
  .story-reader-article h2 {
    font-size: 18pt; font-weight: 600;
    margin: 0 0 0.25in; letter-spacing: 0.02em; line-height: 1.25;
    color: var(--ink); page-break-before: always; page-break-after: avoid;
  }
  .story-reader-article h3 {
    font-size: 14pt; font-weight: 600;
    margin: 0.3in 0 0.12in; line-height: 1.3;
    color: var(--ink); page-break-before: always; page-break-after: avoid;
  }
  .story-reader-article p { margin: 0 0 0.14in; orphans: 3; widows: 3; }
  .story-reader-article .story-reader-divider {
    border: 0; height: 1px; margin: 0.35in auto; width: 60%;
    background: linear-gradient(90deg, transparent 0%, var(--red-dim) 18%, var(--red-dim) 82%, transparent 100%);
  }
  .story-reader-article em { font-style: italic; }
  .story-reader-article strong { font-weight: 700; }
  .story-reader-article .story-reader-inline-link {
    color: var(--red-bright); text-decoration: underline; text-underline-offset: 0.12em;
  }
${PDF_SCENE_FIGURE_CSS}
${endPage ? PDF_END_PAGE_CSS : ""}
</style>
</head>
<body>
${titlePage}
  <article class="story-reader-article">
${bodyHtml}
  </article>
${endHtml}
</body>
</html>`;
}

function defaultOutputPath(args) {
  if (args.part === 1) {
    return join(DEFAULT_OUT_DIR, "andrea-and-lucas-complete", "part-1.pdf");
  }
  return join(
    DEFAULT_OUT_DIR,
    "andrea-and-lucas-complete",
    `chapters-${args.from}-${args.to}.pdf`,
  );
}

function subtitleForArgs(args) {
  if (args.part === 1) return "Part 1";
  if (args.from === args.to) return `Chapter ${args.from}`;
  return `Chapters ${args.from}–${args.to}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let markdown;
  try {
    markdown = readFileSync(STORY_MD, "utf8");
  } catch (e) {
    console.error(`Could not read ${STORY_MD}: ${e.message}`);
    console.error("Run `npm run sync:andrea-complete` first.");
    process.exit(1);
  }

  const excerpt = extractChapterRange(markdown, args.from, args.to, {
    includeInterlude: args.includeInterlude,
  });
  const stories = loadStories();
  const story = mergeAndreaLucasStory(stories) || { scenes: [] };
  const opts = {
    ...READER_OPTS,
    sceneRenderer: makePdfSceneRenderer(story, { repoRoot: REPO_ROOT }),
  };
  const bodyHtml = storyMarkdownToSafeHtml(excerpt, opts);
  const chapters = extractChapters(excerpt).filter((ch) =>
    /^(Chapter \d+:|Interlude:)/i.test(ch.title),
  );

  const title = "Andrea and Lucas";
  const subtitle = subtitleForArgs(args);

  const html = buildHtmlDocument({
    title,
    subtitle,
    bodyHtml,
    endPage: args.endPage,
  });

  const outPath = args.output ? resolve(args.output) : defaultOutputPath(args);
  mkdirSync(dirname(outPath), { recursive: true });

  const tempHtmlPath = join(
    tmpdir(),
    `andrea-${args.part === 1 ? "part-1" : `ch${args.from}-${args.to}`}-${Date.now()}.html`,
  );
  writeFileSync(tempHtmlPath, html, "utf8");

  const chrome = process.env.CHROME_BIN || findChrome();
  console.log(`Rendering ${subtitle} -> ${outPath}`);
  const result = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-pdf-header-footer",
      "--virtual-time-budget=30000",
      `--print-to-pdf=${outPath}`,
      `file://${tempHtmlPath}`,
    ],
    { stdio: "inherit" },
  );

  try {
    unlinkSync(tempHtmlPath);
  } catch {
    /* ignore */
  }

  if (result.status !== 0) {
    console.error(`Chrome exited with status ${result.status}`);
    process.exit(result.status || 1);
  }
  console.log(`Wrote ${outPath} (${chapters.length} top-level headings)`);
}

main();
