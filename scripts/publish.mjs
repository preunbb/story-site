#!/usr/bin/env node
/*
 * Build a publish-ready cover + a pair of EPUBs for a story.
 *
 * Wraps two existing scripts:
 *   1. scripts/make_cover.py   — generates the JPEG cover with the chosen
 *                                title overlaid (in the project's standard
 *                                Optima-on-dark-margin style).
 *   2. scripts/render-story-epub.mjs — generates two EPUB variants:
 *        - <slug>.epub             : text-only, scene illustrations stripped.
 *                                    This is the canonical KDP / commercial
 *                                    upload (no inline imagery to risk a
 *                                    content review tripping on).
 *        - <slug>-illustrated.epub : same text plus the matching scene
 *                                    images embedded inline (with captions),
 *                                    for direct distribution to readers who
 *                                    want the illustrated experience.
 *      Both are built WITHOUT a cover page; the cover JPEG is intended to be
 *      uploaded separately (e.g. to KDP).
 *
 * Usage:
 *   node scripts/publish.mjs <storyId> "<title>"
 *   npm run publish -- <storyId> "<title>"
 *
 * Outputs (relative to repo root):
 *   dist/covers/<title-slug>.jpg
 *   dist/<title-slug>.epub
 *   dist/<title-slug>-illustrated.epub
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { slugify } from "./lib/story-render.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

function usage(msg) {
  if (msg) console.error(`error: ${msg}\n`);
  console.error("Usage: node scripts/publish.mjs <storyId> \"<title>\"");
  process.exit(2);
}

function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith("--"));
  if (positional.length < 2) usage("missing required positional arguments");
  const id = Number(positional[0]);
  if (!Number.isFinite(id) || !Number.isInteger(id)) {
    usage(`<storyId> must be an integer, got ${JSON.stringify(positional[0])}`);
  }
  const title = positional.slice(1).join(" ").trim();
  if (!title) usage("<title> must be a non-empty string");
  return { id, title };
}

function run(label, cmd, args) {
  console.log(`\n[publish] ${label}: ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`[publish] failed to spawn ${cmd}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[publish] ${label} exited with code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function pythonInterpreter() {
  // Reuse the project's pinned Pillow venv so make_cover.py can import PIL.
  const venvPython = join(repoRoot, ".venv-crop", "bin", "python3");
  if (existsSync(venvPython)) return venvPython;
  console.warn(
    `[publish] warning: ${venvPython} not found, falling back to system python3`,
  );
  return "python3";
}

function main() {
  const { id, title } = parseArgs(process.argv.slice(2));

  console.log(`[publish] story id ${id}, title "${title}"`);

  run("rendering cover", pythonInterpreter(), [
    "scripts/make_cover.py",
    String(id),
    "--title",
    title,
  ]);

  // The EPUB renderer's default filename is `dist/<slugify(title)>.epub`.
  // Mirror that slug here so the text-only variant lands at the canonical
  // path (back-compat) and the illustrated variant lands beside it with a
  // clear suffix. Both go to `dist/` via the same default out dir.
  const slug = slugify(title) || "story";
  const textOnlyPath = `dist/${slug}.epub`;
  const illustratedPath = `dist/${slug}-illustrated.epub`;

  run("rendering text-only epub", "node", [
    "scripts/render-story-epub.mjs",
    String(id),
    `--title=${title}`,
    "--no-cover",
    "--no-images",
    `--out=${textOnlyPath}`,
  ]);

  run("rendering illustrated epub", "node", [
    "scripts/render-story-epub.mjs",
    String(id),
    `--title=${title}`,
    "--no-cover",
    `--out=${illustratedPath}`,
  ]);

  console.log("\n[publish] done.");
  console.log(`[publish]   text-only:    ${textOnlyPath}`);
  console.log(`[publish]   illustrated:  ${illustratedPath}`);
}

main();
