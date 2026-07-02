#!/usr/bin/env node
/*
 * Renders a single story's reader output to a self-contained PDF using the
 * same Markdown -> HTML conversion the in-browser reader does (mirrored
 * from script.js' storyMarkdownToSafeHtml; shared via lib/story-render.mjs)
 * and printed via headless Google Chrome.
 *
 * Usage:
 *   node scripts/render-story-pdf.mjs [storyId] [--out=path.pdf]
 *                                       [--title="..."] [--no-images]
 *
 * Defaults to story id 1 (Three Strikes). Story id 43 (Andrea and Lucas) reads
 * the full manuscript from dist/andrea-and-lucas-complete/story.md (synced from
 * the canonical Google Doc via `npm run sync:andrea-complete`). Unless --out is
 * set, writes two PDFs (mirroring the EPUB publish convention):
 *   dist/<slug>.pdf             — text-only, scene illustrations stripped
 *   dist/<slug>-illustrated.pdf — same text plus inline scene images
 *
 * With --out=, renders a single PDF to that path. Add --no-images to strip
 * scene illustrations from that single export.
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
import {
  loadStories,
  findStory,
  readStoryMarkdownForExport,
  storyForExport,
  ANDREA_LUCAS_COMPLETE_STORY_ID,
  slugify,
  escapeHtml,
  storyMarkdownToSafeHtml,
  extractChapters,
  makePdfSceneRenderer,
  PDF_SCENE_FIGURE_CSS,
  PDF_END_PAGE_CSS,
  PDF_PRINT_PALETTE,
  DOC_FONT_CSS,
  buildEndPageHtml,
  DEFAULT_OUT_DIR,
} from "./lib/story-render.mjs";

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
  const out = { id: 1, output: null, title: null, noImages: false };
  for (const arg of argv) {
    if (arg.startsWith("--out=")) {
      out.output = arg.slice("--out=".length);
    } else if (arg.startsWith("--title=")) {
      out.title = arg.slice("--title=".length);
    } else if (arg === "--no-images" || arg === "--text-only") {
      out.noImages = true;
    } else if (/^\d+$/.test(arg)) {
      out.id = Number(arg);
    } else if (!arg.startsWith("--")) {
      const n = Number(arg);
      if (!Number.isNaN(n)) out.id = n;
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

/* ---------- HTML document wrapping ---------- */

function buildTocHtml({ title, chapters }) {
  if (!chapters || !chapters.length) return "";
  let topNum = 0;
  const items = chapters
    .map((ch) => {
      const linkTitle = escapeHtml(ch.title);
      const href = "#" + ch.id;
      topNum += 1;
      return (
        `<li class="toc-item toc-item--h2">` +
        `<span class="toc-num">${topNum}.</span>` +
        `<a class="toc-link" href="${href}">${linkTitle}</a>` +
        `<span class="toc-leader" aria-hidden="true"></span>` +
        `</li>`
      );
    })
    .join("\n      ");

  return `  <section class="toc-page">
    <p class="toc-eyebrow">Contents</p>
    <h1 class="toc-title">${title}</h1>
    <hr class="toc-flourish" />
    <ol class="toc-list">
      ${items}
    </ol>
  </section>`;
}

function buildHtmlDocument({ story, bodyHtml, chapters }) {
  const palette = PDF_PRINT_PALETTE;
  const title = escapeHtml(story.title);
  const tocHtml = buildTocHtml({ title, chapters });
  const endHtml = buildEndPageHtml();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  @page {
    size: Letter;
    margin: 0.85in 0.75in;
  }
  :root {
    --bg: ${palette.bg};
    --ink: ${palette.ink};
    --ink-muted: ${palette.inkMuted};
    --red: ${palette.red};
    --red-bright: ${palette.redBright};
    --red-dim: ${palette.redDim};
    --border: ${palette.border};
  }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  article.story-reader-article {
    max-width: 6.25in;
    margin: 0 auto;
    color: var(--ink);
  }
  .story-reader-article h2 {
    font-size: 18pt;
    font-weight: 600;
    margin: 0 0 0.25in;
    letter-spacing: 0.02em;
    line-height: 1.25;
    color: var(--ink);
    page-break-before: always;
    page-break-after: avoid;
  }
  .story-reader-article h3 {
    font-size: 14pt;
    font-weight: 600;
    margin: 0.3in 0 0.12in;
    line-height: 1.3;
    color: var(--ink);
    page-break-before: always;
    page-break-after: avoid;
  }
  .story-reader-article p {
    margin: 0 0 0.14in;
    orphans: 3;
    widows: 3;
  }
  .story-reader-article .story-reader-divider {
    border: 0;
    height: 1px;
    margin: 0.35in auto;
    width: 60%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--red-dim) 18%,
      var(--red-dim) 82%,
      transparent 100%
    );
  }
  .toc-page {
    page-break-after: always;
    max-width: 5.75in;
    margin: 0 auto;
    padding-top: 0.4in;
  }
  .toc-page .toc-eyebrow {
    font-size: 10pt;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--ink-muted);
    margin: 0 0 0.18in;
    text-align: center;
  }
  .toc-page .toc-title {
    font-size: 26pt;
    font-weight: 700;
    margin: 0 0 0.45in;
    letter-spacing: 0.01em;
    color: var(--ink);
    text-align: center;
    line-height: 1.2;
  }
  .toc-page .toc-flourish {
    border: 0;
    height: 1px;
    margin: 0 auto 0.45in;
    width: 35%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--red-dim) 18%,
      var(--red-dim) 82%,
      transparent 100%
    );
  }
  .toc-page .toc-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .toc-page .toc-item {
    display: flex;
    align-items: baseline;
    gap: 0.45em;
    padding: 0.07in 0;
    line-height: 1.35;
  }
  .toc-page .toc-num {
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    min-width: 1.6em;
    text-align: right;
  }
  .toc-page .toc-link {
    color: var(--ink);
    text-decoration: none;
    font-size: 12pt;
    font-weight: 500;
  }
  .toc-page .toc-leader {
    flex: 1;
    align-self: end;
    margin: 0 0.2em 0.18em;
    height: 0;
    border-bottom: 1px dotted var(--ink-muted);
    opacity: 0.6;
  }
  .story-reader-article em { font-style: italic; }
  .story-reader-article strong { font-weight: 700; }
  .story-reader-article .story-reader-inline-link {
    color: var(--red-bright);
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }
${PDF_SCENE_FIGURE_CSS}
${DOC_FONT_CSS}
${PDF_END_PAGE_CSS}
</style>
</head>
<body>
${tocHtml}
  <article class="story-reader-article">
${bodyHtml}
  </article>
${endHtml}
</body>
</html>`;
}

/* ---------- main ---------- */

function renderPdf({ story, markdown, outPath, noImages }) {
  const imageMode = noImages ? "strip" : "embed";
  const bodyHtml = storyMarkdownToSafeHtml(markdown, {
    ...READER_OPTS,
    sceneRenderer: makePdfSceneRenderer(story, { imageMode }),
  });
  const chapters = extractChapters(markdown);
  const html = buildHtmlDocument({
    story,
    bodyHtml,
    chapters,
  });

  const resolvedOut = resolve(outPath);
  mkdirSync(dirname(resolvedOut), { recursive: true });

  const tempHtmlPath = join(
    tmpdir(),
    `story-${story.id}-${imageMode}-${Date.now()}.html`,
  );
  writeFileSync(tempHtmlPath, html, "utf8");

  const chrome = process.env.CHROME_BIN || findChrome();
  const label = noImages ? "text-only" : "illustrated";
  console.log(`Rendering "${story.title}" (${label}) -> ${resolvedOut}`);
  const result = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-pdf-header-footer",
      "--virtual-time-budget=10000",
      `--print-to-pdf=${resolvedOut}`,
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
  console.log(`Wrote ${resolvedOut}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const stories = loadStories();
  const baseStory = findStory(stories, args.id);
  if (!baseStory) {
    console.error(`No story with id ${args.id} in data/stories.js`);
    process.exit(1);
  }

  const story = storyForExport(baseStory, stories, {
    titleOverride: args.title,
  });

  let markdown;
  try {
    markdown = readStoryMarkdownForExport(story.id);
  } catch (e) {
    console.error(`Could not read story ${story.id} markdown: ${e.message}`);
    if (story.id === ANDREA_LUCAS_COMPLETE_STORY_ID) {
      console.error("Run `npm run sync:andrea-complete` first.");
    } else {
      console.error(`Run \`npm run sync -- --only=${story.id}\` first.`);
    }
    process.exit(1);
  }

  const slug = slugify(story.title);

  if (args.output) {
    renderPdf({
      story,
      markdown,
      outPath: args.output,
      noImages: args.noImages,
    });
    return;
  }

  const textOnlyPath = join(DEFAULT_OUT_DIR, `${slug}.pdf`);
  const illustratedPath = join(DEFAULT_OUT_DIR, `${slug}-illustrated.pdf`);

  if (args.noImages) {
    renderPdf({
      story,
      markdown,
      outPath: textOnlyPath,
      noImages: true,
    });
    return;
  }

  renderPdf({
    story,
    markdown,
    outPath: textOnlyPath,
    noImages: true,
  });
  renderPdf({
    story,
    markdown,
    outPath: illustratedPath,
    noImages: false,
  });
}

main();
