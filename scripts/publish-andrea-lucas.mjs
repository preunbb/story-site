#!/usr/bin/env node
/*
 * One-click Andrea & Lucas publish bundle.
 *
 * Usage:
 *   node scripts/publish-andrea-lucas.mjs [--skip-sync] [--end-page]
 *   npm run publish:andrea-lucas
 *
 * Outputs (gitignored under dist/):
 *   dist/andrea-lucas-published/part-2.pdf
 *   dist/andrea-lucas-published/part-2-illustrated.pdf
 *   dist/andrea-lucas-published/part-2.epub
 *   dist/andrea-lucas-published/complete.pdf
 *   dist/andrea-lucas-published/complete-illustrated.pdf
 *   dist/andrea-lucas-published/covers/part-2.jpg
 *   dist/andrea-lucas-published/covers/complete.jpg
 *   dist/andrea-lucas-published/manifest.json
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ANDREA_LUCAS_COMPLETE_MD,
  findStory,
  loadStories,
  mergeAndreaLucasStory,
} from "./lib/story-render.mjs";
import { writeStoryEpub } from "./lib/build-story-epub.mjs";
import {
  ANDREA_LUCAS_PUBLISH_DIR,
  countWords,
  extractFromChapter,
  readAndreaCompleteMarkdown,
  renderAndreaLucasPdf,
} from "./lib/andrea-lucas-export.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const PART_2_FROM_CHAPTER = 8;
const PART_2_TITLE = "Andrea and Lucas: Part 2";
const PART_2_SUBTITLE = "Part 2";
const COMPLETE_TITLE = "Andrea and Lucas";
const COMPLETE_SUBTITLE = "Complete";

function parseArgs(argv) {
  return {
    skipSync: argv.includes("--skip-sync"),
    endPage: argv.includes("--end-page"),
  };
}

function pythonInterpreter() {
  const venvPython = join(repoRoot, ".venv-crop", "bin", "python3");
  if (existsSync(venvPython)) return venvPython;
  console.warn(
    `[publish:andrea-lucas] warning: ${venvPython} not found, falling back to system python3`,
  );
  return "python3";
}

function run(label, cmd, args) {
  console.log(`\n[publish:andrea-lucas] ${label}: ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { cwd: repoRoot, stdio: "inherit" });
  if (result.error) {
    throw new Error(`failed to spawn ${cmd}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} exited with code ${result.status}`);
  }
}

function makeCover(storyId, title, outPath) {
  run("cover", pythonInterpreter(), [
    "scripts/make_cover.py",
    String(storyId),
    "--title",
    title,
    "-o",
    outPath,
  ]);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.skipSync) {
    run("sync", "node", ["scripts/sync-andrea-lucas-complete-to-dist.mjs"]);
  }

  const markdown = readAndreaCompleteMarkdown();
  const part2Markdown = extractFromChapter(markdown, PART_2_FROM_CHAPTER);

  mkdirSync(join(ANDREA_LUCAS_PUBLISH_DIR, "covers"), { recursive: true });

  const stories = loadStories();
  const part2Story = {
    ...findStory(stories, 47),
    title: PART_2_TITLE,
    scenes: (mergeAndreaLucasStory(stories) || {}).scenes || [],
  };

  const outputs = {};

  outputs["part-2.pdf"] = renderAndreaLucasPdf({
    markdown: part2Markdown,
    title: PART_2_TITLE,
    subtitle: PART_2_SUBTITLE,
    outPath: join(ANDREA_LUCAS_PUBLISH_DIR, "part-2.pdf"),
    noImages: true,
    endPage: args.endPage,
  });

  outputs["part-2-illustrated.pdf"] = renderAndreaLucasPdf({
    markdown: part2Markdown,
    title: PART_2_TITLE,
    subtitle: PART_2_SUBTITLE,
    outPath: join(ANDREA_LUCAS_PUBLISH_DIR, "part-2-illustrated.pdf"),
    noImages: false,
    endPage: args.endPage,
  });

  outputs["part-2.epub"] = writeStoryEpub({
    story: part2Story,
    markdown: part2Markdown,
    outPath: join(ANDREA_LUCAS_PUBLISH_DIR, "part-2.epub"),
    noCover: true,
    noImages: true,
  });

  outputs["complete.pdf"] = renderAndreaLucasPdf({
    markdown,
    title: COMPLETE_TITLE,
    subtitle: COMPLETE_SUBTITLE,
    outPath: join(ANDREA_LUCAS_PUBLISH_DIR, "complete.pdf"),
    noImages: true,
    endPage: args.endPage,
  });

  outputs["complete-illustrated.pdf"] = renderAndreaLucasPdf({
    markdown,
    title: COMPLETE_TITLE,
    subtitle: COMPLETE_SUBTITLE,
    outPath: join(ANDREA_LUCAS_PUBLISH_DIR, "complete-illustrated.pdf"),
    noImages: false,
    endPage: args.endPage,
  });

  const part2Cover = join(ANDREA_LUCAS_PUBLISH_DIR, "covers", "part-2.jpg");
  const completeCover = join(ANDREA_LUCAS_PUBLISH_DIR, "covers", "complete.jpg");
  makeCover(47, PART_2_TITLE, part2Cover);
  makeCover(43, COMPLETE_TITLE, completeCover);
  outputs["covers/part-2.jpg"] = part2Cover;
  outputs["covers/complete.jpg"] = completeCover;

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: ANDREA_LUCAS_COMPLETE_MD,
    wordCounts: {
      complete: countWords(markdown),
      part2: countWords(part2Markdown),
    },
    outputs,
  };
  const manifestPath = join(ANDREA_LUCAS_PUBLISH_DIR, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  outputs["manifest.json"] = manifestPath;

  console.log("\n[publish:andrea-lucas] done.");
  for (const [name, path] of Object.entries(outputs)) {
    console.log(`  ${name}: ${path}`);
  }
}

try {
  main();
} catch (e) {
  console.error(`[publish:andrea-lucas] ${e.message}`);
  process.exit(1);
}
