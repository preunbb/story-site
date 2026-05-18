#!/usr/bin/env node
/**
 * Writes one static HTML file per story under share/<id>.html with Open Graph /
 * Twitter Card metadata so crawlers (Discord, Slack, etc.) can preview links.
 *
 * Hash-only reader URLs (#story/<id>/read) are never sent to the server; share
 * pages use real paths that return unique <head> content.
 *
 * Usage:
 *   PREUN_SITE_ORIGIN=https://preunbb.github.io/story-site node scripts/generate-story-share-pages.mjs
 *
 * Default origin matches the public GitHub Pages deployment. Override when
 * publishing elsewhere.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const storiesPath = join(repoRoot, "data", "stories.js");
const outDir = join(repoRoot, "share");

const SITE_ORIGIN = (
  process.env.PREUN_SITE_ORIGIN ||
  process.env.SITE_ORIGIN ||
  "https://preunbb.github.io/story-site"
).replace(/\/$/, "");

function loadStories() {
  const src = readFileSync(storiesPath, "utf8");
  return new Function(`
    const window = {};
    ${src}
    return window.DATA_STORIES;
  `)();
}

function escapeAttr(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/\r?\n/g, " ");
}

function absoluteCoverUrl(cover) {
  if (!cover) return "";
  const path = String(cover).replace(/^\/+/, "");
  return `${SITE_ORIGIN}/${path}`;
}

function readerUrlForStory(storyId) {
  return `${SITE_ORIGIN}/#story/${encodeURIComponent(String(storyId))}/read`;
}

function buildPageHtml(story) {
  const title = story.title || "Story";
  const description = story.summary || "";
  const readerUrl = readerUrlForStory(story.id);
  const img = absoluteCoverUrl(story.cover);
  const titleEsc = escapeAttr(title);
  const descEsc = escapeAttr(description);
  const readerEsc = escapeAttr(readerUrl);
  const readerJson = JSON.stringify(readerUrl);
  const imgEsc = escapeAttr(img);
  const refreshUrl = readerUrl.replace(/'/g, "%27");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>${titleEsc}</title>
    <link rel="canonical" href="${readerEsc}" />
    <meta property="og:title" content="${titleEsc}" />
    <meta property="og:description" content="${descEsc}" />
    <meta property="og:image" content="${imgEsc}" />
    <meta property="og:url" content="${readerEsc}" />
    <meta property="og:type" content="article" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${titleEsc}" />
    <meta name="twitter:description" content="${descEsc}" />
    <meta name="twitter:image" content="${imgEsc}" />
    <meta http-equiv="refresh" content='0;url=${refreshUrl}' />
    <script>
      location.replace(${readerJson});
    </script>
  </head>
  <body>
    <p><a href="${readerEsc}">Continue to the story reader…</a></p>
  </body>
</html>
`;
}

function main() {
  const stories = loadStories();
  mkdirSync(outDir, { recursive: true });
  const ids = new Set();
  for (const s of stories) {
    if (s == null || s.id == null) continue;
    if (ids.has(s.id)) {
      console.warn(`[share-pages] duplicate story id ${s.id}, skipping duplicate`);
      continue;
    }
    ids.add(s.id);
    const file = join(outDir, `${s.id}.html`);
    writeFileSync(file, buildPageHtml(s), "utf8");
  }
  console.log(
    `[share-pages] wrote ${ids.size} files to share/ (origin ${SITE_ORIGIN})`,
  );
}

main();
