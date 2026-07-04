#!/usr/bin/env node
/*
 * Extract Andrea & Lucas Part 2 free-preview prose (Chapters 8–10) into a
 * committed markdown file for the site reader.
 *
 * Usage: node scripts/sync-andrea-part2-preview-md.mjs
 * Requires: npm run sync:andrea-complete first.
 */

import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractChapterRange,
  readAndreaCompleteMarkdown,
} from "./lib/andrea-lucas-export.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const OUT = join(repoRoot, "assets", "stories", "47-preview.md");

const FROM_CHAPTER = 8;
const TO_CHAPTER = 10;

function main() {
  const md = readAndreaCompleteMarkdown();
  const preview = extractChapterRange(md, FROM_CHAPTER, TO_CHAPTER);
  writeFileSync(OUT, preview, "utf8");
  const words = preview.trim() ? preview.trim().split(/\s+/).length : 0;
  console.log(`Wrote ${OUT} (${words} words, chapters ${FROM_CHAPTER}–${TO_CHAPTER})`);
}

main();
