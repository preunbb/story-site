#!/usr/bin/env node
/**
 * Extract Bereavement Counseling free-preview prose (Chapter 1) into a
 * committed markdown file for the site reader.
 *
 * Usage: node scripts/sync-bereavement-preview-md.mjs
 * Requires: npm run sync:bereavement first (or an existing dist story.md).
 */

import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractChapterRange,
  stripGoogleDocsFrontMatter,
} from "./lib/andrea-lucas-export.mjs";
import { existsSync, readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const INPUT = join(repoRoot, "dist", "bereavement-counseling", "story.md");
const OUT = join(repoRoot, "assets", "stories", "49-preview.md");

const FROM_CHAPTER = 1;
const TO_CHAPTER = 1;

function main() {
  if (!existsSync(INPUT)) {
    console.error(`Missing ${INPUT}\nRun: npm run sync:bereavement`);
    process.exit(1);
  }
  const md = stripGoogleDocsFrontMatter(readFileSync(INPUT, "utf8"));
  const preview = extractChapterRange(md, FROM_CHAPTER, TO_CHAPTER);
  writeFileSync(OUT, preview, "utf8");
  const words = preview.trim() ? preview.trim().split(/\s+/).length : 0;
  console.log(
    `Wrote ${OUT} (${words} words, chapters ${FROM_CHAPTER}–${TO_CHAPTER})`,
  );
}

main();
