/*
 * Shared markdown -> HTML rendering, story metadata loading, and content
 * shared between scripts/render-story-pdf.mjs and scripts/render-story-epub.mjs.
 *
 * The Markdown -> HTML conversion mirrors the in-browser reader in
 * script.js' storyMarkdownToSafeHtml so generated documents look identical
 * to what users see on the site.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createContext, Script } from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const repoRoot = resolve(__dirname, "..", "..");
export const STORIES_JS = join(repoRoot, "data", "stories.js");
export const STORIES_DIR = join(repoRoot, "assets", "stories");
export const COVERS_DIR = join(repoRoot, "assets", "covers");
export const DEFAULT_OUT_DIR = join(repoRoot, "dist");
export const ANDREA_LUCAS_COMPLETE_STORY_ID = 43;
export const ANDREA_LUCAS_COMPLETE_MD = join(
  repoRoot,
  "dist",
  "andrea-and-lucas-complete",
  "story.md",
);

/* ---------- Story metadata loading ---------- */

export function loadStories() {
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

export function findStory(stories, id) {
  return stories.find((s) => Number(s.id) === Number(id));
}

export function readStoryMarkdown(storyId) {
  return readFileSync(join(STORIES_DIR, `${storyId}.md`), "utf8");
}

/** True when PDF/EPUB export should use the full Google Doc manuscript. */
export function isAndreaLucasCompleteExport(storyId) {
  return Number(storyId) === ANDREA_LUCAS_COMPLETE_STORY_ID;
}

/**
 * Markdown source for export scripts. Story id 43 (Andrea and Lucas) reads
 * dist/andrea-and-lucas-complete/story.md — synced from the canonical Google
 * Doc via `npm run sync:andrea-complete` — instead of assets/stories/43.md.
 */
export function readStoryMarkdownForExport(storyId) {
  if (isAndreaLucasCompleteExport(storyId)) {
    if (!existsSync(ANDREA_LUCAS_COMPLETE_MD)) {
      throw new Error(
        `Missing ${ANDREA_LUCAS_COMPLETE_MD}. Run \`npm run sync:andrea-complete\` first.`,
      );
    }
    return readFileSync(ANDREA_LUCAS_COMPLETE_MD, "utf8");
  }
  return readStoryMarkdown(storyId);
}

/**
 * Story metadata for export when the full Andrea & Lucas manuscript is used.
 * Merges Part 1 + Part 2 scene lists and uses the combined title.
 */
export function storyForExport(baseStory, stories, { titleOverride = null } = {}) {
  if (!isAndreaLucasCompleteExport(baseStory.id)) {
    return titleOverride ? { ...baseStory, title: titleOverride } : baseStory;
  }
  const merged = mergeAndreaLucasStory(stories);
  return {
    ...(merged || baseStory),
    id: baseStory.id,
    title: titleOverride || "Andrea and Lucas",
  };
}

export function slugify(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "story"
  );
}

/* ---------- HTML / URL helpers ---------- */

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeMarkdownUrlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeReaderHref(raw) {
  if (!raw || typeof raw !== "string") return null;
  const href = decodeMarkdownUrlEntities(raw).trim();
  if (!href) return null;
  const lower = href.toLowerCase();
  if (
    lower.indexOf("javascript:") === 0 ||
    lower.indexOf("data:") === 0 ||
    lower.indexOf("vbscript:") === 0
  ) {
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    if (/^https?:\/\//i.test(href)) return href;
    if (/^mailto:/i.test(href)) return href;
    return null;
  }
  if (href.indexOf("//") === 0) return "https:" + href;
  if (href.charAt(0) === "/" || href.charAt(0) === "#") return href;
  return "https://" + href;
}

const MD_INLINE_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;

function linkifyEscapedMarkdown(escaped, linkClass) {
  MD_INLINE_LINK.lastIndex = 0;
  return escaped.replace(MD_INLINE_LINK, (_, text, urlRaw) => {
    const href = normalizeReaderHref(urlRaw);
    if (!href) {
      return (
        "[" +
        text +
        "](" +
        escapeHtml(decodeMarkdownUrlEntities(urlRaw).trim()) +
        ")"
      );
    }
    const cls = linkClass ? ` class="${escapeHtml(linkClass)}"` : "";
    return '<a href="' + escapeHtml(href) + '"' + cls + ">" + text + "</a>";
  });
}

function mergeEmphasisAcrossNewlines(escaped) {
  let s = escaped;
  let prev;
  do {
    prev = s;
    s = s.replace(/\*\*([^*]*)\n+([^*]*)\*\*/g, "**$1 $2**");
    s = s.replace(/\*((?:\s*\S[^*\n]*?))\n+([^*\n]+?)\*(?!\*)/g, "*$1 $2*");
    s = s.replace(/__([^_\n]+)\n+([^_]+)__/g, "__$1 $2__");
    s = s.replace(/(^|[\s(>])_([^_\n]+)\n+([^_]+)_/g, "$1_$2 $3_");
  } while (s !== prev);
  return s;
}

function readerInlineEmphasis(escaped) {
  let s = escaped;
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(
    /(^|[\s(>])_([^_\n]+)_([\s),.!?:;<]|$)/g,
    (_m, a, mid, c) => a + "<em>" + mid + "</em>" + c,
  );
  s = s.replace(/\*((?:\s*\S[^*\n]*?))\*(?!\*)/g, "<em>$1</em>");
  return s;
}

/** Drop emphasis markers the inline parser could not pair (nested/malformed md). */
function stripRemainingMarkdownAsterisks(s) {
  return s.replace(/\*/g, "");
}

export function readerFormatEscapedInline(escaped, opts) {
  const linkClass = opts && opts.linkClass ? opts.linkClass : null;
  let s = mergeEmphasisAcrossNewlines(escaped);
  s = linkifyEscapedMarkdown(s, linkClass);
  s = readerInlineEmphasis(s);
  s = stripRemainingMarkdownAsterisks(s);
  return s;
}

/* ---------- Scene-tag helpers ---------- */

/**
 * Match an inline scene tag (`[[scene:identifier]]`) standing alone as its
 * own paragraph. Whitespace inside the brackets is tolerated, mirroring the
 * in-browser reader in script.js.
 */
export const SCENE_TAG_BLOCK_RE = /^\[\[\s*scene\s*:\s*([^\]]+?)\s*\]\]$/i;

/**
 * If `block` is a standalone `[[scene:identifier]]` paragraph, returns the
 * trimmed identifier. Otherwise returns null. Accepts string blocks only.
 */
export function extractSceneTagIdentifier(block) {
  if (typeof block !== "string") return null;
  const m = block.trim().match(SCENE_TAG_BLOCK_RE);
  return m ? m[1].trim() : null;
}

/**
 * Resolves a `[[scene:identifier]]` identifier against `story.scenes`.
 * `identifier` is either a numeric index (0-based) or a substring of a
 * scene's `path`. Returns `{ scene, index }` on a hit, or `null` if no
 * scene matches. Mirrors findStorySceneByIdentifier in script.js.
 */
/** When true, scene figures are omitted on the site and in EPUB image embeds. */
export function storyHidesScenes(story) {
  return story != null && story.hideScenes === true;
}

/** Print palette for PDF output (always light/white background). */
export const PDF_PRINT_PALETTE = {
  bg: "#ffffff",
  ink: "#1f1c21",
  inkMuted: "#5b555f",
  red: "#a14a59",
  redBright: "#a14a59",
  redDim: "#c89aa3",
  border: "rgba(161, 74, 89, 0.25)",
};

/** CSS for inline scene figures in PDF output (shared by PDF renderers). */
export const PDF_SCENE_FIGURE_CSS = `
  .story-reader-article figure.story-scene {
    margin: 0.25in 0;
    page-break-inside: avoid;
    text-align: center;
  }
  .story-reader-article figure.story-scene img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }
  .story-reader-article .story-reader-scene-missing {
    color: var(--ink-muted);
    font-style: italic;
    text-align: center;
  }`;

/** CSS for Google Doc inline formatting preserved through sync. */
export const DOC_FONT_CSS = `
  .story-reader-article .doc-font-mono,
  .chapter-body .doc-font-mono {
    font-family: ui-monospace, "Courier New", Courier, monospace;
  }
  .story-reader-article .doc-font-serif,
  .chapter-body .doc-font-serif {
    font-family: "Times New Roman", Times, Georgia, serif;
  }
  .story-reader-article .doc-font-comic,
  .chapter-body .doc-font-comic {
    font-family: "Comic Sans MS", "Comic Sans", cursive;
  }
  .story-reader-article u,
  .chapter-body u {
    text-decoration: underline;
  }
  .story-reader-article .doc-size-14pt,
  .chapter-body .doc-size-14pt { font-size: 14pt; }
  .story-reader-article .doc-size-15pt,
  .chapter-body .doc-size-15pt { font-size: 15pt; }
  .story-reader-article .doc-size-18pt,
  .chapter-body .doc-size-18pt { font-size: 18pt; }
  .story-reader-article .doc-size-20pt,
  .chapter-body .doc-size-20pt { font-size: 20pt; }
  .story-reader-article .doc-size-26pt,
  .chapter-body .doc-size-26pt { font-size: 26pt; }`;

const DOC_INLINE_CLASS =
  "(?:doc-(?:font-(?:mono|serif|comic)|size-[\\d.]+pt))";
const PRESERVED_INLINE_CHUNK_RE = new RegExp(
  `<span class="(${DOC_INLINE_CLASS}(?:\\s+${DOC_INLINE_CLASS})*)">([\\s\\S]*?)<\\/span>|<u>([\\s\\S]*?)<\\/u>`,
  "g",
);

function hasPreservedInlineHtml(block) {
  return /class="doc-(?:font|size)-|<\/?u>/i.test(block);
}

function formatPreservedInner(inner, opts) {
  if (hasPreservedInlineHtml(inner)) {
    return formatBodyInline(inner, opts);
  }
  const escaped = escapeHtml(inner).replace(/\r\n/g, "\n");
  return readerFormatEscapedInline(escaped, opts).replace(/\n/g, "<br />");
}

/**
 * Merge Andrea and Lucas Part 1 + Part 2 scene lists for full-manuscript exports.
 */
export function mergeAndreaLucasStory(stories) {
  const part1 = findStory(stories, 43);
  const part2 = findStory(stories, 47);
  const base = part2 || part1;
  if (!base) return null;
  return {
    ...base,
    scenes: [].concat((part1 && part1.scenes) || [], (part2 && part2.scenes) || []),
  };
}

/**
 * Resolve standalone `[[scene:…]]` tags to inline `<figure>` HTML for PDF export.
 * Uses absolute `file://` image paths so headless Chrome can embed them.
 */
export function makePdfSceneRenderer(story, opts = {}) {
  const root = opts.repoRoot || repoRoot;
  const strip = opts.imageMode === "strip" || opts.strip === true;
  return function sceneRenderer(identifier) {
    if (storyHidesScenes(story) || strip) return "";
    const match = findStorySceneByIdentifier(story, identifier);
    if (!match) {
      return (
        `<p class="story-reader-scene-missing">[missing scene: ${escapeHtml(identifier)}]</p>`
      );
    }
    const { scene } = match;
    const absPath = resolve(root, scene.path);
    if (!existsSync(absPath)) {
      console.warn(`[pdf] scene image missing on disk: ${scene.path}`);
      return (
        `<p class="story-reader-scene-missing">[missing scene: ${escapeHtml(identifier)}]</p>`
      );
    }
    return (
      `<figure class="story-scene">` +
      `<img src="file://${absPath}" alt="" />` +
      `</figure>`
    );
  };
}

export function findStorySceneByIdentifier(story, identifier) {
  if (!story || !Array.isArray(story.scenes)) return null;
  const id = String(identifier == null ? "" : identifier).trim();
  if (!id) return null;
  if (/^\d+$/.test(id)) {
    const idx = parseInt(id, 10);
    const byIdx = story.scenes[idx];
    if (byIdx && byIdx.path) return { scene: byIdx, index: idx };
  }
  for (let i = 0; i < story.scenes.length; i++) {
    const sc = story.scenes[i];
    if (!sc || !sc.path) continue;
    if (sc.path === id || sc.path.indexOf(id) !== -1) {
      return { scene: sc, index: i };
    }
  }
  return null;
}

/* ---------- Block parsing ---------- */

function parseChapterHeading(block) {
  if (block.indexOf("### ") === 0)
    return { level: 3, title: block.slice(4).trim() };
  if (block.indexOf("## ") === 0)
    return { level: 2, title: block.slice(3).trim() };
  // The codebase treats single-hash `# ` headings the same as `### ` ones
  // (see script.js' storyMarkdownToSafeHtml).
  if (block.indexOf("# ") === 0)
    return { level: 3, title: block.slice(2).trim() };
  return null;
}

function isDividerBlock(block) {
  return /^\s*(?:[-*_]\s*)+$/.test(block);
}

function splitBlocks(markdown) {
  return markdown
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

function formatBodyInline(block, opts) {
  if (!hasPreservedInlineHtml(block)) {
    const escaped = escapeHtml(block).replace(/\r\n/g, "\n");
    return readerFormatEscapedInline(escaped, opts).replace(/\n/g, "<br />");
  }
  PRESERVED_INLINE_CHUNK_RE.lastIndex = 0;
  let out = "";
  let last = 0;
  let m;
  let matched = false;
  while ((m = PRESERVED_INLINE_CHUNK_RE.exec(block))) {
    matched = true;
    const before = block.slice(last, m.index);
    if (before) {
      out += formatPreservedInner(before, opts);
    }
    if (m[1] != null) {
      out +=
        `<span class="${m[1]}">` +
        formatPreservedInner(m[2], opts) +
        `</span>`;
    } else if (m[3] != null) {
      out += `<u>${formatPreservedInner(m[3], opts)}</u>`;
    }
    last = m.index + m[0].length;
  }
  if (!matched) {
    const escaped = escapeHtml(block).replace(/\r\n/g, "\n");
    return readerFormatEscapedInline(escaped, opts).replace(/\n/g, "<br />");
  }
  const tail = block.slice(last);
  if (tail) {
    out += formatPreservedInner(tail, opts);
  }
  return out;
}

function renderParagraph(block, opts) {
  return "<p>" + formatBodyInline(block, opts) + "</p>";
}

/* ---------- Public renderers ---------- */

/**
 * Render a non-heading block (paragraph or divider) to HTML.
 * `opts.dividerClass` and `opts.linkClass` let callers pick their CSS
 * conventions (the on-site reader and the PDF use one set of class names,
 * the EPUB output uses cleaner generic ones).
 *
 * If `opts.sceneRenderer(identifier)` is provided, standalone scene tags
 * (`[[scene:…]]`) are handed off to it. The callback returns either the
 * HTML to substitute (e.g. an <img>/<figure>) or the empty string to drop
 * the block entirely. Without a sceneRenderer, scene tags fall through to
 * regular paragraph rendering (their literal text shows up in output),
 * which is almost never what you want — pass a sceneRenderer.
 */
export function renderBodyBlock(block, opts) {
  const sceneId = extractSceneTagIdentifier(block);
  if (sceneId && opts && typeof opts.sceneRenderer === "function") {
    const out = opts.sceneRenderer(sceneId);
    return out == null ? "" : out;
  }
  if (isDividerBlock(block)) {
    const cls = opts && opts.dividerClass ? opts.dividerClass : "";
    return cls ? `<hr class="${cls}" />` : "<hr />";
  }
  return renderParagraph(block, opts);
}

/**
 * Like `renderBodyBlock`, but if `block` is an ATX heading (`#` … `###`), emit
 * `<h2>` / `<h3>` instead of a paragraph. Used when converting extracted
 * chapter body blocks to standalone HTML (e.g. Reddit-section exports for
 * Google Docs) where sub-headings inside a chapter are still plain blocks.
 */
export function formatBodyInlineHtml(block, opts) {
  return formatBodyInline(block, opts);
}

/** Plain-text title for EPUB/OPF metadata when headings carry inline HTML. */
export function plainTextFromInlineMarkdown(block) {
  return String(block)
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .trim();
}

export function renderFlowBlock(block, opts) {
  const heading = parseChapterHeading(block);
  if (heading) {
    const tag = heading.level === 2 ? "h2" : "h3";
    const inner = hasPreservedInlineHtml(heading.title)
      ? formatBodyInline(heading.title, opts)
      : readerFormatEscapedInline(escapeHtml(heading.title), opts);
    return `<${tag}>${inner}</${tag}>`;
  }
  return renderBodyBlock(block, opts);
}

export function renderBodyBlocks(blocks, opts) {
  return blocks
    .map((b) => renderBodyBlock(b, opts))
    .filter((s) => s !== "")
    .join("\n");
}

/**
 * Render the full markdown to a single HTML body, with chapter headings
 * inlined. This matches what script.js' storyMarkdownToSafeHtml does and is
 * what the PDF generator wants (one continuous HTML document).
 */
export function storyMarkdownToSafeHtml(markdown, opts) {
  const blocks = splitBlocks(markdown);
  const out = [];
  let chapterIndex = 0;
  for (const block of blocks) {
    const heading = parseChapterHeading(block);
    if (heading) {
      const tag = heading.level === 2 ? "h2" : "h3";
      const inner = hasPreservedInlineHtml(heading.title)
        ? formatBodyInline(heading.title, opts)
        : readerFormatEscapedInline(escapeHtml(heading.title), opts);
      const id = "story-ch-" + chapterIndex++;
      out.push(
        `<${tag} id="${id}" class="story-reader-chapter story-reader-chapter--h${heading.level}">${inner}</${tag}>`,
      );
    } else {
      out.push(renderBodyBlock(block, opts));
    }
  }
  return out.join("");
}

/**
 * Walk the markdown and return one entry per chapter heading. IDs are
 * compatible with anchors inside storyMarkdownToSafeHtml output.
 */
export function extractChapters(markdown) {
  const blocks = splitBlocks(markdown);
  const chapters = [];
  let chapterIndex = 0;
  for (const block of blocks) {
    const heading = parseChapterHeading(block);
    if (!heading) continue;
    chapters.push({
      index: chapterIndex,
      id: "story-ch-" + chapterIndex,
      level: heading.level,
      title: heading.title,
    });
    chapterIndex++;
  }
  return chapters;
}

/**
 * Split markdown into per-chapter buckets so each chapter can become its
 * own XHTML file in an EPUB (which is what gives Kindle nice "chapter"
 * navigation and clean per-chapter page breaks).
 *
 * Returns: [{ index, id, level, title, blocks: string[] }]
 *
 * Any blocks that appear before the first heading are folded into the first
 * chapter (or, if there are no headings at all, surfaced as a single
 * untitled chapter).
 */
export function splitMarkdownByChapter(markdown) {
  const blocks = splitBlocks(markdown);
  const chapters = [];
  let current = null;
  let chapterIndex = 0;
  const leading = [];
  for (const block of blocks) {
    const heading = parseChapterHeading(block);
    if (heading) {
      if (current) chapters.push(current);
      current = {
        index: chapterIndex,
        id: "story-ch-" + chapterIndex,
        level: heading.level,
        title: heading.title,
        blocks: [],
      };
      chapterIndex++;
    } else if (current) {
      current.blocks.push(block);
    } else {
      leading.push(block);
    }
  }
  if (current) chapters.push(current);
  if (leading.length) {
    if (chapters.length) {
      chapters[0] = {
        ...chapters[0],
        blocks: [...leading, ...chapters[0].blocks],
      };
    } else {
      // Stories with no chapter headings collapse into a single untitled
      // chapter. Renderers detect the empty title and skip rendering a
      // chapter header so the story doesn't display a placeholder label.
      chapters.push({
        index: 0,
        id: "story-ch-0",
        level: 2,
        title: "",
        blocks: leading,
      });
    }
  }
  return chapters;
}

/* ---------- Shared back-matter content ---------- */

/**
 * The "Until next time" end-page content. Both the PDF and the EPUB use
 * this so the back matter stays in sync. Plain data so each renderer can
 * lay it out in its own native style.
 *
 * The Ko-fi tip jar was intentionally removed because Amazon KDP's content
 * guidelines forbid driving readers to external monetization platforms.
 */
export const END_PAGE = {
  title: "Until next time",
  paragraphs: [
    "You made it to the end. Hopefully your gonads are more functional than the ones you just read about.",
    "I love hearing from readers. Whether you've got feedback, a request, an oddly specific scenario you've been dying to see written, a unformatted wall of text meticulously describing each and every ballbusting fantasy you've ever masturbated to, or just want to correct all of my typoes, drop me a line.",
  ],
  contacts: [
    {
      label: "Email",
      text: "boozlejam@gmail.com",
      href: "mailto:boozlejam@gmail.com",
    },
    {
      label: "Discord",
      text: "preunbb#8470",
      href: "https://discord.com/users/400812177658871809",
    },
    {
      label: "Reddit",
      text: "u/preunbb",
      href: "https://reddit.com/u/preunbb",
    },
  ],
  signoff: "— Preun",
};

/** CSS for the shared END_PAGE back matter in PDF output. */
export const PDF_END_PAGE_CSS = `
  .end-page {
    page-break-before: always;
    max-width: 5.5in;
    margin: 0 auto;
    padding-top: 0.5in;
    text-align: center;
  }
  .end-page .end-flourish {
    border: 0;
    height: 1px;
    margin: 0 auto 0.45in;
    width: 45%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--red-dim) 18%,
      var(--red-dim) 82%,
      transparent 100%
    );
  }
  .end-page .end-title {
    font-size: 22pt;
    font-weight: 700;
    margin: 0 0 0.35in;
    letter-spacing: 0.02em;
    color: var(--ink);
  }
  .end-page .end-message {
    color: var(--ink);
    font-size: 11.5pt;
    line-height: 1.65;
    margin: 0 0 0.18in;
    text-align: left;
  }
  .end-page .end-message + .end-message {
    margin-top: 0.05in;
  }
  .end-page .end-contacts {
    list-style: none;
    margin: 0.4in auto 0.35in;
    padding: 0;
    display: inline-block;
    text-align: left;
    color: var(--ink-muted);
    font-size: 11pt;
    line-height: 1.9;
  }
  .end-page .end-contacts a {
    color: var(--red-bright);
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }
  .end-page .end-contacts .end-contact-label {
    color: var(--ink-muted);
    display: inline-block;
    width: 4.25em;
  }
  .end-page .end-signoff {
    color: var(--ink-muted);
    font-style: italic;
    margin: 0.5in 0 0;
    font-size: 11pt;
  }`;

export function buildEndPageHtml() {
  const paragraphs = END_PAGE.paragraphs
    .map((p) => `    <p class="end-message">${escapeHtml(p)}</p>`)
    .join("\n");
  const contacts = END_PAGE.contacts
    .map(
      (c) =>
        `      <li>` +
        `<span class="end-contact-label">${escapeHtml(c.label)}</span>` +
        `<a href="${escapeHtml(c.href)}">${escapeHtml(c.text)}</a>` +
        `</li>`,
    )
    .join("\n");
  return `  <section class="end-page">
    <hr class="end-flourish" />
    <h1 class="end-title">${escapeHtml(END_PAGE.title)}</h1>
${paragraphs}
    <ul class="end-contacts">
${contacts}
    </ul>
    <p class="end-signoff">${escapeHtml(END_PAGE.signoff)}</p>
  </section>`;
}
