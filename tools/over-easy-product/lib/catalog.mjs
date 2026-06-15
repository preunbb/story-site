import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createContext, Script } from "node:vm";

const SCENES_DIR = "assets/scenes/andrea_and_lucas";

/** @param {string} repoRoot */
export function loadCatalog(repoRoot) {
  const path = join(repoRoot, "over-easy-products", "products.js");
  const code = readFileSync(path, "utf8");
  const sandbox = { window: {} };
  createContext(sandbox);
  new Script(code, { filename: "products.js" }).runInContext(sandbox);
  const catalog = sandbox.window.OVER_EASY_CATALOG;
  if (!catalog?.products) throw new Error("OVER_EASY_CATALOG.products missing");
  return { path, catalog };
}

/** @param {string} repoRoot @param {typeof catalog} catalog */
export function writeCatalog(repoRoot, catalog) {
  const path = join(repoRoot, "over-easy-products", "products.js");
  const body = formatProductsJs(catalog);
  writeFileSync(path, body, "utf8");
  return path;
}

/** @param {import("./slug.mjs").typeof catalog} catalog */
function formatProductsJs(catalog) {
  const products = catalog.products
    .map((p) => formatProductEntry(p))
    .join(",\n");

  const brand = catalog.brand;
  const footerNote = brand.footerNote
    ? `\n    footerNote:\n      ${JSON.stringify(brand.footerNote)},`
    : "";

  return `/**
 * Over Easy Technologies — product catalog config
 *
 * Edit this file to change copy, images, features, or add/remove products.
 * Paths are relative to over-easy-products/index.html
 *
 * New products: npm run oe-product -- "Product Name"
 */
window.OVER_EASY_CATALOG = {
  brand: {
    name: ${JSON.stringify(brand.name)},
    tagline: ${JSON.stringify(brand.tagline)},
    logo: ${JSON.stringify(brand.logo)},${footerNote}
  },

  products: [
${products}
  ],
};
`;
}

/** @param {Record<string, unknown>} p */
function formatProductEntry(p) {
  const lines = [
    "    {",
    `      id: ${JSON.stringify(p.id)},`,
    `      name: ${JSON.stringify(p.name)},`,
  ];
  if (p.model) lines.push(`      model: ${JSON.stringify(p.model)},`);
  lines.push(`      image:`, `        ${JSON.stringify(p.image)},`);
  if (p.tagline) lines.push(`      tagline: ${JSON.stringify(p.tagline)},`);
  lines.push(`      description:`, `        ${JSON.stringify(p.description)},`);
  if (p.features?.length) {
    lines.push(`      features: [`);
    for (const f of p.features) {
      lines.push(`        ${JSON.stringify(f)},`);
    }
    lines.push(`      ],`);
  }
  if (p.badge) lines.push(`      badge: ${JSON.stringify(p.badge)},`);
  lines.push("    }");
  return lines.join("\n");
}

/**
 * @param {string} repoRoot
 * @param {string} basename e.g. overeasy_sterilizer_device
 */
export function nextAssetVersion(repoRoot, basename) {
  const dir = join(repoRoot, SCENES_DIR);
  if (!existsSync(dir)) return 1;
  const re = new RegExp(
    `^${basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_v(\\d+)\\.png$`,
  );
  let max = 0;
  for (const file of readdirSync(dir)) {
    const m = file.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** @param {string} repoRoot @param {string} relativePath */
export function assetExists(repoRoot, relativePath) {
  return existsSync(join(repoRoot, relativePath.replace(/^\.\.\//, "")));
}
