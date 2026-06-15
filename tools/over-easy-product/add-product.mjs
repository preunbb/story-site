#!/usr/bin/env node
/**
 * Scaffold a new Over Easy Technologies catalog product from story prose.
 *
 * Usage:
 *   npm run oe-product -- "Shell Shaker"
 *   npm run oe-product -- "Shell Shaker" --apply
 *   npm run oe-product -- "Shell Shaker" --apply --force
 *
 * Story excerpts are used internally for product specs only. Published catalog
 * copy is coy marketing for a female buyer audience — no characters or events.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { slugify, modelCode, assetBasename } from "./lib/slug.mjs";
import { searchStoryForProduct } from "./lib/story-search.mjs";
import {
  extractProductSpecs,
  buildMarketingCopy,
  COPY_VOICE_RULES,
} from "./lib/copy-voice.mjs";
import {
  loadCatalog,
  writeCatalog,
  nextAssetVersion,
  assetExists,
} from "./lib/catalog.mjs";
import {
  getHints,
  buildImagePrompt,
  buildAgentBrief,
  logoPath,
} from "./lib/prompts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const args = process.argv.slice(2);
const flags = {
  apply: args.includes("--apply"),
  force: args.includes("--force"),
};
const productName = args.find((a) => !a.startsWith("--"));

if (!productName) {
  console.error(`Usage: npm run oe-product -- "Product Name" [--apply] [--force]`);
  process.exit(1);
}

const slug = slugify(productName);
const hints = getHints(slug, productName);
const id = hints.catalogId ?? slug;
const model = hints.model ?? modelCode(slug);
const basename = assetBasename(slug, hints.kind ?? "device");
const version = nextAssetVersion(repoRoot, basename);
const assetFilename = `${basename}_v${version}.png`;
const imageRelative = `../assets/scenes/andrea_and_lucas/${assetFilename}`;

const excerpts = searchStoryForProduct(repoRoot, productName);
const productSpecs = extractProductSpecs(excerpts);
const copy = buildMarketingCopy({ slug, hints, specs: productSpecs });

const displayName = hints.displayName ?? productName;
const catalogEntry = {
  id,
  name: displayName,
  model,
  image: imageRelative,
  tagline: copy.tagline,
  description: copy.description,
  features: copy.features,
  badge: hints.badge ?? "Hardware",
};

const imagePrompt = buildImagePrompt({
  productName: displayName,
  assetRelative: imageRelative,
  productSpecs,
  hints,
});

const draftDir = join(repoRoot, "over-easy-products", "drafts", slug);
mkdirSync(draftDir, { recursive: true });

const referenceAssets = hints.referenceAssets ?? [];
const existingAssets = referenceAssets.filter((p) => assetExists(repoRoot, p));

const draft = {
  productName: displayName,
  id,
  slug,
  model,
  image: imageRelative,
  assetFilename,
  badge: catalogEntry.badge,
  logoPath: logoPath(),
  referenceAssets,
  existingAssets,
  excerpts,
  productSpecs,
  copyVoiceRules: COPY_VOICE_RULES,
  imagePrompt,
  catalogEntry,
  draftJsonPath: `over-easy-products/drafts/${slug}/catalog-entry.json`,
};

writeFileSync(
  join(draftDir, "catalog-entry.json"),
  JSON.stringify(
    { catalogEntry, productSpecs, excerptsNote: "internal only", imagePrompt, assetFilename },
    null,
    2,
  ),
);
writeFileSync(join(draftDir, "copy-voice.txt"), COPY_VOICE_RULES + "\n");
writeFileSync(join(draftDir, "image-prompt.txt"), imagePrompt + "\n");
writeFileSync(join(draftDir, "AGENT_BRIEF.md"), buildAgentBrief(draft));

console.log(`\nOver Easy product draft: ${displayName}`);
console.log(`  slug:     ${slug}`);
console.log(`  id:       ${id}`);
console.log(`  asset:    assets/scenes/andrea_and_lucas/${assetFilename}`);
console.log(`  specs:    ${productSpecs.length} from story (internal)`);
console.log(`  draft:    over-easy-products/drafts/${slug}/`);
console.log(`\nCatalog copy uses coy marketing voice — no story characters/events.`);
console.log(`Next: generate image from AGENT_BRIEF.md, then:`);
console.log(`  npm run oe-product -- "${productName}" --apply\n`);

if (flags.apply) {
  const { catalog } = loadCatalog(repoRoot);
  const idx = catalog.products.findIndex((p) => p.id === id);
  if (idx >= 0 && !flags.force) {
    console.error(
      `Product id "${id}" already in products.js — use --force to replace.`,
    );
    process.exit(1);
  }
  if (idx >= 0) {
    const existingImage = catalog.products[idx].image;
    catalog.products[idx] = catalogEntry;
    // Refresh copy only — keep published asset path unless product is new
    catalog.products[idx].image = existingImage;
  } else {
    catalog.products.push(catalogEntry);
  }

  const out = writeCatalog(repoRoot, catalog);
  console.log(`Updated ${out}`);
  console.log(`Preview: http://localhost:8080/over-easy-products/#product-${id}`);
}

process.exit(0);
