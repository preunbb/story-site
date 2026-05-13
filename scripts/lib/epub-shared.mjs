/*
 * Shared EPUB building blocks used by both the single-story EPUB
 * generator (render-story-epub.mjs) and the multi-story anthology
 * generator (render-anthology-epub.mjs).
 *
 * Anything that controls the visual identity of the output (stylesheet,
 * cover page, "Until next time" back matter, container.xml, author /
 * UUID conventions, XHTML page wrapper) lives here so both renderers
 * stay in sync.
 *
 * Renderer-specific composition (title pages, table of contents, OPF /
 * NCX, file naming) lives in the per-renderer scripts because the two
 * formats arrange chapters differently.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { createHash } from "node:crypto";
import {
  END_PAGE,
  escapeHtml,
  extractSceneTagIdentifier,
  findStorySceneByIdentifier,
  repoRoot,
  storyHidesScenes,
} from "./story-render.mjs";

/* ---------- Constants ---------- */

export const AUTHOR = "Preun";
export const NS_UUID = "urn:uuid:9b9b1d60-7c1c-5a6a-9d0a-preun-story-site";

export const READER_OPTS = {
  linkClass: "story-link",
  dividerClass: "scene-break",
};

export const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

/* ---------- IDs and timestamps ---------- */

// Deterministic UUID v5-ish derived from a name so re-generating the same
// book produces the same dc:identifier (KDP treats it as the book identity).
export function deterministicUuid(name) {
  const hash = createHash("sha1")
    .update(NS_UUID + "|" + name)
    .digest("hex");
  const v = (parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80;
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),
    v.toString(16).padStart(2, "0") + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-");
}

export function nowIsoSecond() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/* ---------- Cover detection ---------- */

const COVER_MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function coverDescriptorForPath(absPath) {
  if (!absPath || !existsSync(absPath)) return null;
  const ext = extname(absPath).toLowerCase();
  const mime = COVER_MIME_BY_EXT[ext];
  if (!mime) return null;
  return { src: absPath, name: "cover" + ext, mime };
}

// Story.cover is a repo-relative path like "assets/covers/three_strikes.jpg".
export function findStoryCover(story) {
  if (!story || !story.cover) return null;
  return coverDescriptorForPath(join(repoRoot, story.cover));
}

// For renderers that accept an explicit cover path on the CLI.
export function coverFromAbsolutePath(absPath) {
  return coverDescriptorForPath(absPath);
}

/* ---------- XHTML helpers ---------- */

const XHTML_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" type="text/css" href="../styles.css" />
`;

export function xhtmlPage({ title, bodyClass, body, extraHead }) {
  return (
    XHTML_HEAD +
    `  <title>${escapeHtml(title)}</title>\n` +
    (extraHead || "") +
    "</head>\n" +
    `<body${bodyClass ? ` class="${escapeHtml(bodyClass)}"` : ""}>\n` +
    body +
    "\n</body>\n</html>\n"
  );
}

/* ---------- Shared content pages ---------- */

export function buildCoverPage(cover) {
  if (!cover) return null;
  return xhtmlPage({
    title: "Cover",
    bodyClass: "cover",
    body:
      `  <section epub:type="cover" class="cover-page">\n` +
      `    <img src="../${escapeHtml(cover.name)}" alt="Cover" />\n` +
      `  </section>`,
  });
}

export function buildAboutPage() {
  const paras = END_PAGE.paragraphs
    .map((p) => `    <p class="end-message">${escapeHtml(p)}</p>`)
    .join("\n");
  const contacts = END_PAGE.contacts
    .map(
      (c) =>
        `      <li><span class="end-contact-label">${escapeHtml(c.label)}</span> ` +
        `<a href="${escapeHtml(c.href)}" class="story-link">${escapeHtml(c.text)}</a></li>`,
    )
    .join("\n");
  const body =
    `  <section epub:type="afterword" class="end-page">\n` +
    `    <hr class="end-flourish" />\n` +
    `    <h1 class="end-title">${escapeHtml(END_PAGE.title)}</h1>\n` +
    paras +
    `\n    <ul class="end-contacts">\n${contacts}\n    </ul>\n` +
    `    <p class="end-signoff">${escapeHtml(END_PAGE.signoff)}</p>\n` +
    `  </section>`;
  return xhtmlPage({
    title: END_PAGE.title,
    bodyClass: "about",
    body,
  });
}

/* ---------- Scene image embedding ---------- */

const SCENE_IMAGE_MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function safeImageBasename(p) {
  // Keep the original basename when it's already filesystem-safe; otherwise
  // fall back to a sanitized version. The EPUB spec only requires the path
  // be a URL-encodable IRI, so this is conservative.
  const raw = basename(p);
  return raw.replace(/[^A-Za-z0-9._-]+/g, "_");
}

/**
 * Walks every block in `blocks`, finds standalone `[[scene:…]]` tags that
 * resolve against `story.scenes`, and returns one descriptor per unique
 * referenced scene (in first-seen order). Scenes whose file is missing on
 * disk are skipped with a warning.
 *
 * Descriptor fields:
 *   manifestId   — stable id for the <item> in the OPF manifest
 *   internalPath — path inside the EPUB zip, relative to OEBPS/
 *                  (e.g. "images/s030-scene-01-foo.jpg")
 *   xhtmlSrc     — relative path from chapter XHTML to the image
 *                  (e.g. "../images/s030-scene-01-foo.jpg")
 *   srcAbs       — absolute filesystem path
 *   mime         — image media type
 *   scene        — the original story.scenes[i] object
 *   index        — scene's position in story.scenes
 *   data         — Buffer of the image bytes (ready to drop into the zip)
 *
 * `prefix` lets the anthology renderer namespace per-story image ids
 * (e.g. `s030-`) so two stories with the same scene index don't collide.
 */
export function collectReferencedSceneImages(story, blocks, opts = {}) {
  if (storyHidesScenes(story)) return [];
  const prefix = opts.prefix || "";
  const result = [];
  const seen = new Set();
  for (const block of blocks) {
    const id = extractSceneTagIdentifier(block);
    if (!id) continue;
    const match = findStorySceneByIdentifier(story, id);
    if (!match) continue;
    if (seen.has(match.index)) continue;
    seen.add(match.index);

    const srcAbs = join(repoRoot, match.scene.path);
    if (!existsSync(srcAbs)) {
      console.warn(
        `[epub] scene image missing on disk, dropping: ${match.scene.path}`,
      );
      continue;
    }
    const ext = extname(match.scene.path).toLowerCase();
    const mime = SCENE_IMAGE_MIME_BY_EXT[ext] || "application/octet-stream";
    const ordinal = String(result.length + 1).padStart(2, "0");
    const safeBase = safeImageBasename(match.scene.path);
    const manifestId = `img-${prefix}scene-${ordinal}`;
    const internalPath = `images/${prefix}scene-${ordinal}-${safeBase}`;

    result.push({
      manifestId,
      internalPath,
      xhtmlSrc: `../${internalPath}`,
      srcAbs,
      mime,
      scene: match.scene,
      index: match.index,
      data: readFileSync(srcAbs),
    });
  }
  return result;
}

/**
 * Build a sceneRenderer callback for renderBodyBlock from a story + mode.
 *
 *   imageMode = "embed" with sceneImageMap: emit a <figure>/<img>/<figcaption>
 *   imageMode = "embed" but image missing/unmapped: silently strip the tag
 *   imageMode = "strip":                            silently strip the tag
 *
 * "Silently strip" rather than "leave a placeholder" keeps published EPUBs
 * clean — a missing scene image shouldn't produce a "[missing scene: …]"
 * blob in someone's Kindle.
 */
export function makeEpubSceneRenderer({ story, imageMode, sceneImageMap }) {
  return function sceneRenderer(identifier) {
    if (storyHidesScenes(story)) return "";
    if (imageMode !== "embed") return "";
    if (!sceneImageMap) return "";
    const match = findStorySceneByIdentifier(story, identifier);
    if (!match) return "";
    const img = sceneImageMap.get(match.index);
    if (!img) return "";
    const altSource =
      match.scene.caption || story.title || "Scene illustration";
    const alt = escapeHtml(altSource);
    const caption = match.scene.caption
      ? `<figcaption class="scene-caption">${escapeHtml(match.scene.caption)}</figcaption>`
      : "";
    return (
      `<figure class="scene-figure">` +
      `<img src="${escapeHtml(img.xhtmlSrc)}" alt="${alt}" />` +
      caption +
      `</figure>`
    );
  };
}

/* ---------- Shared chapter rendering ---------- */

import { renderBodyBlocks } from "./story-render.mjs";

/**
 * Render one chapter to XHTML.
 *
 * To embed scene images, pass `story`, `imageMode: "embed"`, and a
 * `sceneImageMap` (Map<sceneIndex, sceneImageDescriptor>) populated from
 * `collectReferencedSceneImages`. To strip scene tags entirely (e.g. for
 * a text-only EPUB) pass `imageMode: "strip"`. The default is "strip" —
 * passing nothing keeps the literal `[[scene:…]]` markers out of output
 * even when the caller hasn't been updated for the image pipeline yet.
 */
export function buildChapterPage({
  title,
  num,
  total,
  blocks,
  story = null,
  imageMode = "strip",
  sceneImageMap = null,
}) {
  const opts = {
    ...READER_OPTS,
    sceneRenderer: makeEpubSceneRenderer({
      story,
      imageMode,
      sceneImageMap,
    }),
  };
  const bodyHtml = renderBodyBlocks(blocks, opts);
  // When a chapter has no title (e.g. a single-chapter story with no
  // markdown headings), suppress the visible chapter header entirely;
  // the surrounding title page already establishes context.
  const header = title
    ? `    <header class="chapter-header">\n` +
      `      <p class="chapter-eyebrow">Chapter ${num} of ${total}</p>\n` +
      `      <h1 class="chapter-title">${escapeHtml(title)}</h1>\n` +
      `    </header>\n`
    : "";
  return xhtmlPage({
    title: title || `Chapter ${num}`,
    bodyClass: "chapter",
    body:
      `  <section epub:type="chapter" class="chapter">\n` +
      header +
      `    <div class="chapter-body">\n` +
      bodyHtml +
      `\n    </div>\n` +
      `  </section>`,
  });
}

/* ---------- Stylesheet ---------- */

// Deliberately conservative for ebook readers. No backgrounds, em-based
// sizing, no fixed widths -- so dark mode, font scaling, and reflow on
// arbitrary screen sizes (Kindle / phone / Kobo / etc.) all keep working.
//
// Includes selectors for both the single-story and anthology layouts.
// Selectors that don't match anything in a given build are harmless and
// only cost a few hundred bytes of unused CSS.
export function buildStylesheet() {
  return `@charset "utf-8";

body {
  margin: 0;
  padding: 0;
  font-family: serif;
  line-height: 1.55;
  font-size: 1em;
}

/* Cover */
body.cover { margin: 0; padding: 0; }
.cover-page {
  margin: 0;
  padding: 0;
  text-align: center;
  page-break-after: always;
}
.cover-page img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}

/* Title page */
.titlepage {
  text-align: center;
  page-break-after: always;
  margin-top: 25%;
}
.titlepage .title-main {
  font-size: 2.2em;
  font-weight: bold;
  margin: 0 0 1em;
  line-height: 1.2;
}
.titlepage .title-summary {
  font-style: italic;
  font-size: 1.05em;
  margin: 0 1em 2em;
  line-height: 1.45;
}
.titlepage .title-byline {
  font-size: 1.1em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0;
}

/* Contents */
.contents-page { page-break-after: always; }
.contents-page .toc-eyebrow {
  font-size: 0.8em;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-align: center;
  margin: 1em 0 0.4em;
}
.contents-page .toc-title {
  font-size: 1.7em;
  font-weight: bold;
  text-align: center;
  margin: 0 0 1em;
  line-height: 1.2;
}
.contents-page .toc-flourish {
  border: 0;
  height: 0;
  text-align: center;
  margin: 0 25% 1.5em;
  border-top: 1px solid currentColor;
  opacity: 0.35;
}
.contents-page .toc-h2 {
  font-size: 0;
  height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
.contents-page .toc-list {
  list-style: none;
  margin: 0;
  padding: 0 1em;
}
.contents-page .toc-list li { margin: 0.5em 0; }
.contents-page .toc-list a {
  text-decoration: none;
  color: inherit;
}
.contents-page .toc-num {
  display: inline-block;
  min-width: 2em;
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
}
/* Anthology TOC: optional secondary line under each story title */
.contents-page .toc-list .toc-summary {
  display: block;
  margin: 0.25em 0 0 2em;
  font-size: 0.85em;
  font-style: italic;
  opacity: 0.7;
  line-height: 1.4;
}
.hidden { display: none; }

/* Chapter pages */
.chapter { page-break-before: always; }
.chapter-header {
  text-align: center;
  margin: 1.5em 0 1.5em;
}
.chapter-eyebrow {
  font-size: 0.7em;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  margin: 0 0 0.6em;
  opacity: 0.7;
}
.chapter-title {
  font-size: 1.6em;
  font-weight: bold;
  margin: 0;
  line-height: 1.25;
}
.chapter-body { margin: 0; }
.chapter-body p {
  margin: 0;
  text-indent: 1.2em;
  orphans: 2;
  widows: 2;
}
.chapter-body p + p { margin-top: 0.4em; }
.chapter-body .chapter-header + p,
.chapter-body p:first-child,
.chapter-body hr + p { text-indent: 0; }

.chapter-body em { font-style: italic; }
.chapter-body strong { font-weight: bold; }
.chapter-body .story-link {
  color: inherit;
  text-decoration: underline;
}

/* Inline scene illustrations (illustrated EPUB only). Keep these
   max-width:100% so reflowable readers scale them sensibly on small
   screens; page-break-inside:avoid keeps figure + caption together
   when paginating. */
.scene-figure {
  margin: 1.4em 0;
  text-align: center;
  page-break-inside: avoid;
  break-inside: avoid;
}
.scene-figure img {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
}
.scene-caption {
  font-style: italic;
  font-size: 0.9em;
  line-height: 1.4;
  margin: 0.4em 1em 0;
  opacity: 0.8;
}

/* Scene break */
.scene-break {
  border: 0;
  height: 0;
  text-align: center;
  margin: 1.4em 0;
}
.scene-break::after {
  content: "* * *";
  letter-spacing: 0.5em;
  display: block;
  opacity: 0.55;
}

/* Story separator (anthology) */
body.story-separator { margin: 0; padding: 0; }
.story-separator-page {
  text-align: center;
  page-break-before: always;
  page-break-after: always;
  margin-top: 28%;
}
.story-separator-page .story-eyebrow {
  font-size: 0.8em;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  margin: 0 0 0.8em;
  opacity: 0.65;
}
.story-separator-page .story-title {
  font-size: 2em;
  font-weight: bold;
  margin: 0 0 1em;
  line-height: 1.2;
}
.story-separator-page .story-summary {
  font-style: italic;
  font-size: 1em;
  margin: 0 1.5em;
  line-height: 1.5;
  opacity: 0.85;
}
.story-separator-page .story-flourish {
  border: 0;
  height: 0;
  border-top: 1px solid currentColor;
  opacity: 0.35;
  margin: 1.6em 32% 0;
}

/* About / end page */
.end-page {
  page-break-before: always;
  text-align: center;
  margin-top: 2em;
}
.end-page .end-flourish {
  border: 0;
  height: 0;
  border-top: 1px solid currentColor;
  opacity: 0.35;
  margin: 0 30% 1.5em;
}
.end-page .end-title {
  font-size: 1.6em;
  font-weight: bold;
  margin: 0 0 1.2em;
}
.end-page .end-message {
  text-align: left;
  margin: 0 1em 0.8em;
  line-height: 1.55;
}
.end-page .end-contacts {
  list-style: none;
  margin: 1.6em auto 1em;
  padding: 0;
  display: inline-block;
  text-align: left;
  line-height: 1.9;
}
.end-page .end-contact-label {
  display: inline-block;
  min-width: 4.5em;
  opacity: 0.7;
}
.end-page .end-contacts a {
  color: inherit;
  text-decoration: underline;
}
.end-page .end-signoff {
  font-style: italic;
  margin: 1.5em 0 0;
  opacity: 0.7;
}
`;
}
