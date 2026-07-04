#!/usr/bin/env node
/*
 * One-click Andrea & Lucas publish bundle.
 *
 * Usage:
 *   node scripts/publish-andrea-lucas.mjs [--skip-sync] [--end-page]
 *   npm run publish:andrea-lucas
 *
 * When sync is enabled (default), also refreshes assets/stories/47-preview.md.
 * For doc → preview → all publish outputs in one shot (with end page), use:
 *   npm run rebuild:andrea-from-doc
 *
 * Outputs (gitignored under dist/):
 *   dist/andrea-lucas-published/part-1.pdf
 *   dist/andrea-lucas-published/part-1-illustrated.pdf
 *   dist/andrea-lucas-published/part-2.pdf
 *   dist/andrea-lucas-published/part-2-illustrated.pdf
 *   dist/andrea-lucas-published/part-2.epub
 *   dist/andrea-lucas-published/complete.pdf
 *   dist/andrea-lucas-published/complete-illustrated.pdf
 *   dist/andrea-lucas-published/covers/part-1.jpg
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
  extractChapterRange,
  extractFromChapter,
  readAndreaCompleteMarkdown,
  renderAndreaLucasPdf,
} from "./lib/andrea-lucas-export.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const PART_1_FROM_CHAPTER = 1;
const PART_1_TO_CHAPTER = 7;
const PART_1_TITLE = "Andrea and Lucas: Part 1";
const PART_1_SUBTITLE = "Part 1";
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
    run("preview", "node", ["scripts/sync-andrea-part2-preview-md.mjs"]);
  }

  const markdown = readAndreaCompleteMarkdown();
  const part1Markdown = extractChapterRange(
    markdown,
    PART_1_FROM_CHAPTER,
    PART_1_TO_CHAPTER,
  );
  const part2Markdown = extractFromChapter(markdown, PART_2_FROM_CHAPTER);

  mkdirSync(join(ANDREA_LUCAS_PUBLISH_DIR, "covers"), { recursive: true });

  const stories = loadStories();
  const part1Story = findStory(stories, 43);
  const part2Story = {
    ...findStory(stories, 47),
    title: PART_2_TITLE,
    scenes: (mergeAndreaLucasStory(stories) || {}).scenes || [],
  };

  const part1Cover = join(ANDREA_LUCAS_PUBLISH_DIR, "covers", "part-1.jpg");
  const part2Cover = join(ANDREA_LUCAS_PUBLISH_DIR, "covers", "part-2.jpg");
  const completeCover = join(ANDREA_LUCAS_PUBLISH_DIR, "covers", "complete.jpg");
  makeCover(43, PART_1_TITLE, part1Cover);
  makeCover(47, PART_2_TITLE, part2Cover);
  makeCover(43, COMPLETE_TITLE, completeCover);

  const outputs = {};

  outputs["part-1.pdf"] = renderAndreaLucasPdf({
    markdown: part1Markdown,
    title: PART_1_TITLE,
    subtitle: PART_1_SUBTITLE,
    outPath: join(ANDREA_LUCAS_PUBLISH_DIR, "part-1.pdf"),
    noImages: true,
    endPage: args.endPage,
    story: part1Story,
  });

  outputs["part-1-illustrated.pdf"] = renderAndreaLucasPdf({
    markdown: part1Markdown,
    title: PART_1_TITLE,
    subtitle: PART_1_SUBTITLE,
    outPath: join(ANDREA_LUCAS_PUBLISH_DIR, "part-1-illustrated.pdf"),
    noImages: false,
    endPage: args.endPage,
    story: part1Story,
  });

  outputs["part-2.pdf"] = renderAndreaLucasPdf({
    markdown: part2Markdown,
    title: PART_2_TITLE,
    subtitle: PART_2_SUBTITLE,
    outPath: join(ANDREA_LUCAS_PUBLISH_DIR, "part-2.pdf"),
    noImages: true,
    endPage: args.endPage,
    story: part2Story,
  });

  outputs["part-2-illustrated.pdf"] = renderAndreaLucasPdf({
    markdown: part2Markdown,
    title: PART_2_TITLE,
    subtitle: PART_2_SUBTITLE,
    outPath: join(ANDREA_LUCAS_PUBLISH_DIR, "part-2-illustrated.pdf"),
    noImages: false,
    endPage: args.endPage,
    story: part2Story,
  });

  outputs["part-2.epub"] = writeStoryEpub({
    story: part2Story,
    markdown: part2Markdown,
    outPath: join(ANDREA_LUCAS_PUBLISH_DIR, "part-2.epub"),
    coverPath: part2Cover,
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

  const part1CoverOut = part1Cover;
  const part2CoverOut = part2Cover;
  const completeCoverOut = completeCover;
  outputs["covers/part-1.jpg"] = part1CoverOut;
  outputs["covers/part-2.jpg"] = part2CoverOut;
  outputs["covers/complete.jpg"] = completeCoverOut;

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: ANDREA_LUCAS_COMPLETE_MD,
    wordCounts: {
      complete: countWords(markdown),
      part1: countWords(part1Markdown),
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
