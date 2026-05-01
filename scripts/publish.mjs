#!/usr/bin/env node
/*
 * Build a publish-ready cover + EPUB pair for a story.
 *
 * Wraps two existing scripts:
 *   1. scripts/make_cover.py   — generates the JPEG cover with the chosen
 *                                title overlaid (in the project's standard
 *                                Optima-on-dark-margin style).
 *   2. scripts/render-story-epub.mjs — generates the EPUB with the chosen
 *                                title used in metadata, on the title page,
 *                                in the contents, and in the NCX. The EPUB
 *                                is built WITHOUT a cover page, since the
 *                                cover JPEG is intended to be uploaded
 *                                separately (e.g. to KDP).
 *
 * Usage:
 *   node scripts/publish.mjs <storyId> "<title>"
 *   npm run publish -- <storyId> "<title>"
 *
 * Outputs (relative to repo root):
 *   dist/covers/<title-slug>.jpg
 *   dist/<title-slug>.epub
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

  run("rendering epub (no cover page)", "node", [
    "scripts/render-story-epub.mjs",
    String(id),
    `--title=${title}`,
    "--no-cover",
  ]);

  console.log("\n[publish] done.");
}

main();
