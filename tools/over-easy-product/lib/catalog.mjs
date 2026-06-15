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

/** @param {string} repoRoot @param {string} id */
export function findCatalogProduct(repoRoot, id) {
  const { catalog } = loadCatalog(repoRoot);
  return catalog.products.find((p) => p.id === id) ?? null;
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
  const purchaseUrl = brand.purchaseUrl
    ? `\n    purchaseUrl: ${JSON.stringify(brand.purchaseUrl)},`
    : "";

  const categories = catalog.categories?.length
    ? `\n\n  categories: [\n${catalog.categories
        .map(
          (c) =>
            `    { id: ${JSON.stringify(c.id)}, label: ${JSON.stringify(c.label)} },`,
        )
        .join("\n")}\n  ],`
    : "";

  return `/**
 * Over Easy Technologies — product catalog config
 *
 * Edit this file to change copy, images, features, or add/remove products.
 * This is the single source of truth for catalog copy — oe-product tooling reads from here.
 * Paths are relative to over-easy-products/index.html
 *
 * New products: npm run oe-product -- "Product Name"
 *
 * Editor: word-wrap + no autocomplete — see .vscode/settings.json (oe-catalog language).
 * Format on save: installs Run on Save extension (see .vscode/extensions.json), or run npm run format:oe-catalog.
 */
window.OVER_EASY_CATALOG = {
  brand: {
    name: ${JSON.stringify(brand.name)},
    tagline: ${JSON.stringify(brand.tagline)},
    logo: ${JSON.stringify(brand.logo)},${footerNote}${purchaseUrl}
  },${categories}

  products: [
${products}
  ],
};
`;
}

/** Max chars per line when writing wrapped string literals. */
const WRAP_COL = 88;

/**
 * @param {string} str
 * @param {string} fieldIndent e.g. "      " before key, value uses +8
 */
function formatWrappedString(str, fieldIndent = "      ") {
  const valueIndent = `${fieldIndent}  `;
  if (!str) return `${valueIndent}${JSON.stringify("")},`;

  const maxChunk = WRAP_COL - valueIndent.length - 2;
  const words = str.split(/\s+/);
  const chunks = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChunk && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  if (chunks.length === 1) {
    return `${valueIndent}${JSON.stringify(chunks[0])},`;
  }

  return chunks
    .map((chunk, i) => {
      const text = i < chunks.length - 1 ? `${chunk} ` : chunk;
      const suffix = i < chunks.length - 1 ? " +" : ",";
      return `${valueIndent}${JSON.stringify(text)}${suffix}`;
    })
    .join("\n");
}

/** @param {object[]} sizeOptions */
function formatSizeOptions(sizeOptions) {
  const fields = sizeOptions.map((field) => {
    const opts = field.options
      .map((opt) => {
        const parts = [
          `value: ${JSON.stringify(opt.value)}`,
          `label: ${JSON.stringify(opt.label)}`,
        ];
        if (opt.soldOut) parts.push("soldOut: true");
        return `{ ${parts.join(", ")} }`;
      })
      .join(", ");
    return `{ id: ${JSON.stringify(field.id)}, label: ${JSON.stringify(field.label)}, options: [${opts}] }`;
  });
  return `[\n        ${fields.join(",\n        ")},\n      ]`;
}

/** @param {Record<string, unknown>} p */
function formatProductEntry(p) {
  const lines = [
    "    {",
    `      id: ${JSON.stringify(p.id)},`,
  ];
  if (p.category) lines.push(`      category: ${JSON.stringify(p.category)},`);
  lines.push(`      name: ${JSON.stringify(p.name)},`);
  if (p.model) lines.push(`      model: ${JSON.stringify(p.model)},`);
  lines.push(`      image:`, `        ${JSON.stringify(p.image)},`);
  if (p.tagline) {
    lines.push(`      tagline:`);
    lines.push(formatWrappedString(p.tagline).replace(/,$/, ","));
  }
  lines.push(`      description:`);
  lines.push(formatWrappedString(p.description));
  if (p.features?.length) {
    lines.push(`      features: [`);
    for (const f of p.features) {
      const wrapped = formatWrappedString(f, "        ");
      lines.push(wrapped.replace(/,$/, ","));
    }
    lines.push(`      ],`);
  }
  if (p.sizeOptions?.length) {
    lines.push(`      sizeOptions: ${formatSizeOptions(p.sizeOptions)},`);
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
