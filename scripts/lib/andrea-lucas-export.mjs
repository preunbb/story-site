/*
 * Shared Andrea & Lucas manuscript slicing + PDF rendering for publish bundles.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import {
  ANDREA_LUCAS_COMPLETE_MD,
  storyMarkdownToSafeHtml,
  extractChapters,
  escapeHtml,
  mergeAndreaLucasStory,
  makePdfSceneRenderer,
  PDF_SCENE_FIGURE_CSS,
  PDF_END_PAGE_CSS,
  PDF_PRINT_PALETTE,
  DOC_FONT_CSS,
  buildEndPageHtml,
  loadStories,
} from "./story-render.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ANDREA_LUCAS_PUBLISH_DIR = join(
  resolve(__dirname, "..", ".."),
  "dist",
  "andrea-lucas-published",
);

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

const CHAPTER_HEADING_RE = /^# Chapter (\d+):[^\n]*/gm;

export function readAndreaCompleteMarkdown() {
  if (!existsSync(ANDREA_LUCAS_COMPLETE_MD)) {
    throw new Error(
      `Missing ${ANDREA_LUCAS_COMPLETE_MD}. Run \`npm run sync:andrea-complete\` first.`,
    );
  }
  return readFileSync(ANDREA_LUCAS_COMPLETE_MD, "utf8");
}

/** Slice from `# Chapter N:` through end of manuscript (includes Epilogue). */
export function extractFromChapter(markdown, fromChapter) {
  const matches = [...markdown.matchAll(CHAPTER_HEADING_RE)];
  const start = matches.find((m) => Number(m[1]) === fromChapter);
  if (!start) {
    throw new Error(`Chapter ${fromChapter} not found in complete manuscript`);
  }
  return markdown.slice(start.index).trim() + "\n";
}

export function countWords(md) {
  const t = md.trim();
  return t ? t.split(/\s+/).length : 0;
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

function buildTocHtml({ title, chapters }) {
  if (!chapters?.length) return "";
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
    <h1 class="toc-title">${escapeHtml(title)}</h1>
    <hr class="toc-flourish" />
    <ol class="toc-list">
      ${items}
    </ol>
  </section>`;
}

function buildHtmlDocument({ title, subtitle, bodyHtml, chapters, endPage }) {
  const palette = PDF_PRINT_PALETTE;
  const titlePage = buildTitlePageHtml({ title, subtitle });
  const tocHtml = buildTocHtml({ title, chapters });
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
    background: linear-gradient(90deg, transparent 0%, var(--red-dim) 18%, var(--red-dim) 82%, transparent 100%);
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
${PDF_SCENE_FIGURE_CSS}
${DOC_FONT_CSS}
${endPage ? PDF_END_PAGE_CSS : ""}
</style>
</head>
<body>
${titlePage}
${tocHtml}
  <article class="story-reader-article">
${bodyHtml}
  </article>
${endHtml}
</body>
</html>`;
}

export function loadAndreaExportStory() {
  const stories = loadStories();
  return mergeAndreaLucasStory(stories) || { scenes: [] };
}

/**
 * Render one Andrea & Lucas PDF edition.
 *
 * @param {object} opts
 * @param {string} opts.markdown
 * @param {string} opts.title
 * @param {string} opts.subtitle
 * @param {string} opts.outPath
 * @param {boolean} opts.noImages
 * @param {boolean} [opts.endPage]
 */
export function renderAndreaLucasPdf({
  markdown,
  title,
  subtitle,
  outPath,
  noImages,
  endPage = false,
}) {
  const story = loadAndreaExportStory();
  const imageMode = noImages ? "strip" : "embed";
  const bodyHtml = storyMarkdownToSafeHtml(markdown, {
    ...READER_OPTS,
    sceneRenderer: makePdfSceneRenderer(story, { imageMode }),
  });
  const chapters = extractChapters(markdown);
  const html = buildHtmlDocument({
    title,
    subtitle,
    bodyHtml,
    chapters,
    endPage,
  });

  const resolvedOut = resolve(outPath);
  mkdirSync(dirname(resolvedOut), { recursive: true });

  const tempHtmlPath = join(
    tmpdir(),
    `andrea-lucas-${imageMode}-${Date.now()}.html`,
  );
  writeFileSync(tempHtmlPath, html, "utf8");

  const chrome = process.env.CHROME_BIN || findChrome();
  const label = noImages ? "text-only" : "illustrated";
  console.log(`[andrea-lucas] ${subtitle} (${label}) -> ${resolvedOut}`);
  const result = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-pdf-header-footer",
      "--virtual-time-budget=60000",
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
    throw new Error(`Chrome exited with status ${result.status}`);
  }
  console.log(`[andrea-lucas] wrote ${resolvedOut}`);
  return resolvedOut;
}
