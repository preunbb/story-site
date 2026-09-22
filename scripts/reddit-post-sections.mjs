#!/usr/bin/env node
/*
 * Split a story into markdown files suited for Reddit (one file per markdown
 * "chapter" heading — same sectioning as scripts/render-story-epub.mjs).
 *
 * - Drops standalone [[scene:…]] blocks entirely (scene illustrations).
 * - Strips Markdown image syntax (![](…)) wherever it appears.
 * - Leaves other markdown (bold, italic, dividers ---) unchanged.
 *
 * By default also writes a sibling `.html` per section. Import that file into
 * Google Docs (`import_to_google_doc`, source_format html): `<hr />` maps to
 * Docs' page-wide horizontal lines; plain Markdown import often does not.
 *
 * Usage:
 *   node scripts/reddit-post-sections.mjs <storyId> [--out=DIR] [--no-google-doc-html]
 *
 * Without --out=, writes into a directory under OS temp (logged on exit).
 *
 * Note: Reddit self-post body limit is ~40k characters per post — this script
 * logs a warning when a section exceeds REDDIT_APPROX_BODY_LIMIT_CHARS.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  escapeHtml,
  extractSceneTagIdentifier,
  findStory,
  loadStories,
  readStoryMarkdown,
  renderFlowBlock,
  slugify,
  splitMarkdownByChapter,
} from "./lib/story-render.mjs";

const REDDIT_APPROX_BODY_LIMIT_CHARS = 40_000;

const MD_IMAGE_RE = /!\[[^\]]*?\]\([^)]*\)/g;

function usage(msg) {
  if (msg) console.error(`error: ${msg}\n`);
  console.error(
    `Usage: node scripts/reddit-post-sections.mjs <storyId> [--out=DIR] [--no-google-doc-html]`,
  );
  process.exit(2);
}

function parseArgs(argv) {
  let id = null;
  let outDir = null;
  /** Emit `.html` siblings with `<hr />` for Google Docs import (default: true). */
  let googleDocHtml = true;
  for (const arg of argv) {
    if (arg.startsWith("--out=")) {
      outDir = arg.slice("--out=".length);
    } else if (arg === "--no-google-doc-html") {
      googleDocHtml = false;
    } else if (arg === "--google-doc-html") {
      googleDocHtml = true;
    } else if (/^\d+$/.test(arg)) {
      id = Number(arg);
    } else if (!arg.startsWith("--")) {
      usage(`unexpected argument ${JSON.stringify(arg)}`);
    }
  }
  if (id == null || !Number.isFinite(id))
    usage("missing or invalid numeric <storyId>");
  return { id, outDir, googleDocHtml };
}

/** Remove markdown images; tighten whitespace left behind. */
function stripMarkdownImages(block) {
  return String(block)
    .replace(MD_IMAGE_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .trimEnd();
}

/** Build Reddit-oriented markdown body from EPUB chapter `blocks`. */
function blocksToRedditMarkdown(blocks) {
  const kept = [];
  for (let block of blocks) {
    if (extractSceneTagIdentifier(block) != null) continue;
    block = stripMarkdownImages(block);
    if (!block.trim()) continue;
    kept.push(block);
  }
  return kept.join("\n\n").replace(/\n{4,}/g, "\n\n\n").trim() + "\n";
}

const GOOGLE_DOC_HTML_OPTS = {
  sceneRenderer: () => "",
};

/** Minimal HTML body for Google Docs import: real `<hr />` scene breaks. */
function blocksToGoogleDocHtmlBody(blocks) {
  const parts = [];
  for (let block of blocks) {
    if (extractSceneTagIdentifier(block) != null) continue;
    block = stripMarkdownImages(block);
    if (!block.trim()) continue;
    const html = renderFlowBlock(block, GOOGLE_DOC_HTML_OPTS);
    if (html) parts.push(html);
  }
  return parts.join("\n");
}

function wrapGoogleDocHtmlFragment(innerHtml, documentTitle) {
  return (
    `<!DOCTYPE html>\n` +
    `<html lang="en">\n<head>\n` +
    `<meta charset="utf-8" />\n` +
    `<title>${escapeHtml(documentTitle)}</title>\n` +
    `</head>\n<body>\n` +
    innerHtml +
    `\n</body>\n</html>\n`
  );
}

/** Safe filename slug; empty title → "part". */
function sectionSlug(title, fallbackIndex) {
  const raw = slugify(title) || `part-${fallbackIndex + 1}`;
  return raw.slice(0, 72) || "section";
}

function main() {
  const { id, outDir: outArg, googleDocHtml } = parseArgs(process.argv.slice(2));
  const stories = loadStories();
  const story = findStory(stories, id);
  if (!story)
    usage(`no story found with id ${id}`);

  let markdown;
  try {
    markdown = readStoryMarkdown(story.id);
  } catch (e) {
    console.error(`Could not read story ${story.id} markdown: ${e.message}`);
    process.exit(1);
  }

  const chapters = splitMarkdownByChapter(markdown);
  if (!chapters.length) {
    console.error(`Story ${story.id} has no extractable sections.`);
    process.exit(1);
  }

  const baseSlug = slugify(story.title) || `story-${story.id}`;
  const outDir =
    outArg != null && outArg.length > 0
      ? resolve(outArg)
      : mkdtempSync(join(tmpdir(), `reddit-${baseSlug}-`));

  mkdirSync(outDir, { recursive: true });

  const n = chapters.length;
  console.log(`[reddit-post-sections] story ${story.id} "${story.title}" → ${n} section(s) at ${outDir}`);
  if (googleDocHtml) {
    console.log(
      `[reddit-post-sections] also writing .html per section for Google Docs import (horizontal rules as <hr />); pass --no-google-doc-html to skip`,
    );
  }

  for (let i = 0; i < n; i++) {
    const ch = chapters[i];
    const part = i + 1;
    const titleLine = ch.title
      ? `**${story.title}** — Part ${part} of ${n} · ${ch.title}`
      : `**${story.title}** — Part ${part} of ${n}`;

    const body = blocksToRedditMarkdown(ch.blocks);
    const fileBody = `${titleLine}\n\n${body}`;
    const name = `${String(part).padStart(2, "0")}_${sectionSlug(ch.title || "", i)}.md`;
    const path = join(outDir, name);
    writeFileSync(path, fileBody, "utf8");

    if (googleDocHtml) {
      const titleHtml = renderFlowBlock(titleLine, GOOGLE_DOC_HTML_OPTS);
      const bodyHtml = blocksToGoogleDocHtmlBody(ch.blocks);
      const fragment = `${titleHtml}\n${bodyHtml}`;
      const htmlName = name.replace(/\.md$/i, "") + ".html";
      const htmlPath = join(outDir, htmlName);
      const docTitle = `${story.title} — part ${part} of ${n}`;
      writeFileSync(htmlPath, wrapGoogleDocHtmlFragment(fragment, docTitle), "utf8");
    }

    const len = fileBody.length;
    if (len > REDDIT_APPROX_BODY_LIMIT_CHARS) {
      console.warn(
        `[reddit-post-sections] warning: ${name} is ~${len} chars (>${REDDIT_APPROX_BODY_LIMIT_CHARS}; may exceed Reddit limit)`,
      );
    }
  }
}

main();
