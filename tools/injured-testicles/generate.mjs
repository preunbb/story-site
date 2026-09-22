#!/usr/bin/env node
/**
 * Scaffold an injured-testicle image from healthy_veiny.png + your description.
 *
 * Usage:
 *   npm run injured-testicles -- "punctured left testis, milky fluid spraying"
 *   npm run injured-testicles -- "create injured testicles, both bruised purple and swollen"
 *
 * Writes tools/injured-testicles/drafts/latest.json with prompt + paths.
 * Generate the image with Cursor remote GenerateImage, passing the reference file.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseInjuryDescription, slugify } from "./lib/slug.mjs";
import {
  REFERENCE_IMAGE,
  DEFAULT_OUTPUT_DIR,
  assetExists,
  nextVersion,
  buildFilename,
} from "./lib/paths.mjs";
import { buildImagePrompt, NEGATIVE_PROMPT_HINTS } from "./lib/prompt.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const args = process.argv.slice(2);
const outDirFlag = args.indexOf("--out-dir");
const outputDir =
  outDirFlag >= 0 && args[outDirFlag + 1]
    ? args[outDirFlag + 1]
    : DEFAULT_OUTPUT_DIR;
const positional = args.filter((a, i) => {
  if (a.startsWith("--")) return false;
  if (outDirFlag >= 0 && i === outDirFlag + 1) return false;
  return true;
});
const rawInput = positional.join(" ").trim();

if (!rawInput) {
  console.error(`Usage: npm run injured-testicles -- "<injury description>"`);
  console.error(`       npm run injured-testicles -- "create injured testicles, <description>"`);
  console.error(`       npm run injured-testicles -- "<description>" --out-dir assets/brands`);
  process.exit(1);
}

const injuryDescription = parseInjuryDescription(rawInput);
if (!injuryDescription) {
  console.error("Error: injury description is empty after parsing.");
  process.exit(1);
}

if (!assetExists(repoRoot, REFERENCE_IMAGE)) {
  console.error(`Error: reference image missing: ${REFERENCE_IMAGE}`);
  process.exit(1);
}

const injurySlug = slugify(injuryDescription) || "injured";
const stem = injurySlug ? `healthy_veiny_${injurySlug}` : "healthy_veiny_injured";
const version = nextVersion(repoRoot, outputDir, stem);
const assetFilename = buildFilename(injurySlug, version);
const imageRelative = join(outputDir, assetFilename).replace(/\\/g, "/");

const imagePrompt = buildImagePrompt({ injuryDescription });

const draft = {
  tool: "injured-testicles",
  referenceImage: REFERENCE_IMAGE,
  referenceImageNote:
    "Canonical healthy bilateral veiny testes plate — pass as reference_image_paths to GenerateImage",
  injuryDescription,
  injurySlug,
  imagePrompt,
  negativePromptHints: NEGATIVE_PROMPT_HINTS,
  assetFilename,
  image: imageRelative,
  generateSteps: [
    `Read ${REFERENCE_IMAGE} with the Read tool.`,
    "Call remote GenerateImage with reference_image_paths including that file.",
    `Save output to ${imageRelative} (never overwrite an existing file).`,
  ],
};

const draftDir = join(__dirname, "drafts");
mkdirSync(draftDir, { recursive: true });
const draftPath = join(draftDir, "latest.json");
writeFileSync(draftPath, JSON.stringify(draft, null, 2) + "\n");

console.log(`\nInjured testicles draft`);
console.log(`  reference:  ${REFERENCE_IMAGE}`);
console.log(`  injury:     ${injuryDescription}`);
console.log(`  output:     ${imageRelative}`);
console.log(`  draft:      tools/injured-testicles/drafts/latest.json`);
console.log(`\nNext: read the reference image, generate with remote GenerateImage,`);
console.log(`      save to the versioned path above.\n`);
