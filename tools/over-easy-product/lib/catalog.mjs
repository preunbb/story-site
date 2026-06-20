import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createContext, Script } from "node:vm";

const SCENES_DIR = "assets/scenes/andrea_and_lucas";

/** @param {string} repoRoot */
export function loadCatalog(repoRoot) {
  const path = join(repoRoot, "oe-catalog", "products.js");
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
  const path = join(repoRoot, "oe-catalog", "products.js");
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
        .map((c) => {
          const parts = [
            `id: ${JSON.stringify(c.id)}`,
            `label: ${JSON.stringify(c.label)}`,
          ];
          if (c.hidden) parts.push("hidden: true");
          return `    { ${parts.join(", ")} },`;
        })
        .join("\n")}\n  ],`
    : "";

  return `/**
 * Over Easy Technologies — product catalog config
 *
 * Edit this file to change copy, images, features, setlist, or add/remove products.
 * This is the single source of truth for catalog copy — oe-product tooling reads from here.
 * Paths are relative to over-easy-products.html (repo root)
 *
 * purchaseUrl — optional. Story reader (#story/N/read), Ko-fi, etc. Hash-only
 * story links are resolved to the site root by over-easy-products.html.
 * Omit for “Coming soon!” products.
 *
 * New products: npm run oe-product -- "Product Name"
 *
 * Editor: word-wrap + no autocomplete — see .vscode/settings.json (oe-catalog language).
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

/** @param {object[]} images */
function formatImages(images) {
  const items = images.map((img) => {
    const parts = [`path: ${JSON.stringify(img.path)}`];
    if (img.caption) parts.push(`caption: ${JSON.stringify(img.caption)}`);
    return `{ ${parts.join(", ")} }`;
  });
  return `[\n        ${items.join(",\n        ")},\n      ]`;
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
        if (opt.disabled) parts.push("disabled: true");
        if (opt.imageIndex != null) parts.push(`imageIndex: ${opt.imageIndex}`);
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
  if (p.purchaseUrl) {
    lines.push(`      purchaseUrl: ${JSON.stringify(p.purchaseUrl)},`);
  }
  lines.push(`      name: ${JSON.stringify(p.name)},`);
  if (p.model) lines.push(`      model: ${JSON.stringify(p.model)},`);
  lines.push(`      image: ${JSON.stringify(p.image)},`);
  if (p.images?.length) {
    lines.push(`      images: ${formatImages(p.images)},`);
  }
  if (p.tagline) {
    lines.push(`      tagline: ${JSON.stringify(p.tagline)},`);
  }
  lines.push(`      description: ${JSON.stringify(p.description)},`);
  if (p.setlist?.length) {
    lines.push(`      setlist: [`);
    for (const item of p.setlist) {
      lines.push(`        ${JSON.stringify(item)},`);
    }
    lines.push(`      ],`);
  }
  if (p.features?.length) {
    lines.push(`      features: [`);
    for (const f of p.features) {
      lines.push(`        ${JSON.stringify(f)},`);
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
