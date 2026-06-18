#!/usr/bin/env node
/**
 * Scaffold a new Over Easy Technologies catalog product from story prose.
 *
 * Usage:
 *   npm run oe-product -- "Shell Shaker"
 *   npm run oe-product -- "Shell Shaker" --apply
 *
 * Writes a single draft.json (image workflow scratch — not published).
 * Catalog copy lives only in oe-catalog/products.js.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { slugify, modelCode, assetBasename } from "./lib/slug.mjs";
import { searchStoryForProduct } from "./lib/story-search.mjs";
import { extractProductSpecs, buildMarketingCopy } from "./lib/copy-voice.mjs";
import {
  loadCatalog,
  writeCatalog,
  findCatalogProduct,
  nextAssetVersion,
  assetExists,
} from "./lib/catalog.mjs";
import { getHints, buildImagePrompt, logoPath } from "./lib/prompts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const productName = args.find((a) => !a.startsWith("--"));

if (!productName) {
  console.error(`Usage: npm run oe-product -- "Product Name" [--apply]`);
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
const existingProduct = findCatalogProduct(repoRoot, id);
const copy = buildMarketingCopy({
  slug,
  hints,
  specs: productSpecs,
  existingProduct,
});

const displayName = existingProduct?.name ?? hints.displayName ?? productName;
const starterCatalogEntry = {
  id,
  category: existingProduct?.category ?? hints.category ?? "discipline",
  name: displayName,
  model: existingProduct?.model ?? model,
  image: imageRelative,
  tagline: copy.tagline,
  description: copy.description,
  features: copy.features,
  badge: existingProduct?.badge ?? hints.badge ?? "Hardware",
};

const imagePrompt = buildImagePrompt({
  productName: displayName,
  assetRelative: imageRelative,
  productSpecs,
  hints,
});

const draftDir = join(repoRoot, "oe-catalog", "drafts", slug);
mkdirSync(draftDir, { recursive: true });

const referenceAssets = hints.referenceAssets ?? [];
const existingAssets = referenceAssets.filter((p) => assetExists(repoRoot, p));

const draft = {
  id,
  slug,
  productName: displayName,
  isNewProduct: !existingProduct,
  catalogCopySource: "oe-catalog/products.js",
  assetFilename,
  image: imageRelative,
  imagePrompt,
  logoPath: logoPath(),
  referenceAssets,
  existingAssets,
  productSpecs,
  excerpts,
  excerptsNote: "Internal research only — do not paste into products.js",
  previewUrl: `http://localhost:8080/over-easy-products.html#product-${id}`,
  applyCommand: `npm run oe-product -- "${productName}" --apply`,
  ...(existingProduct ? {} : { starterCatalogEntry }),
};

writeFileSync(join(draftDir, "draft.json"), JSON.stringify(draft, null, 2) + "\n");

console.log(`\nOver Easy product draft: ${displayName}`);
console.log(`  slug:     ${slug}`);
console.log(`  id:       ${id}`);
console.log(`  asset:    assets/scenes/andrea_and_lucas/${assetFilename}`);
console.log(`  specs:    ${productSpecs.length} from story (internal)`);
console.log(`  draft:    oe-catalog/drafts/${slug}/draft.json`);
if (existingProduct) {
  console.log(`\nCatalog copy: edit oe-catalog/products.js`);
} else {
  console.log(`\nNew product — edit products.js, then --apply adds starter entry + image`);
}
console.log(`\nNext: read draft.json, generate image, then:`);
console.log(`  npm run oe-product -- "${productName}" --apply\n`);

if (apply) {
  const { catalog } = loadCatalog(repoRoot);
  const idx = catalog.products.findIndex((p) => p.id === id);

  if (idx >= 0) {
    catalog.products[idx] = {
      ...catalog.products[idx],
      image: imageRelative,
    };
    console.log(`Updated image path in products.js (copy unchanged).`);
  } else {
    catalog.products.push({
      ...starterCatalogEntry,
      image: imageRelative,
    });
    console.log(`Added new product to products.js.`);
  }

  const out = writeCatalog(repoRoot, catalog);
  console.log(`Wrote ${out}`);
  console.log(`Preview: http://localhost:8080/over-easy-products.html#product-${id}`);
}

process.exit(0);
