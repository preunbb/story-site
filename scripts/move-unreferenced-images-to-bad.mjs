/**
 * Move unreferenced image files to repo-root bad/.
 *
 * Protected (never moved):
 *   - assets/brands/
 *   - assets/captions/  (entire caption project trees)
 *   - assets/over-easy/ (Over Easy product catalog)
 *   - bad/ itself
 *
 * Referenced = path appears in site-facing sources (stories, characters,
 * captions index, OE catalog, HTML share pages, main script/CSS).
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEST = path.join(ROOT, "bad");

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

const PROTECTED_PREFIXES = [
  "assets/brands/",
  "assets/captions/",
  "assets/over-easy/",
  "bad/",
];

const SITE_FILES = [
  "data/stories.js",
  "data/characters.js",
  "data/captions.js",
  "oe-catalog/products.js",
  "index.html",
  "over-easy-products.html",
  "404.html",
  "script.js",
  "oe-catalog/styles.css",
];

const SKIP_WALK_DIRS = new Set([
  "node_modules",
  ".git",
  "bad",
  ".cursor",
  "tools",
]);

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function isProtectedRel(rel) {
  return PROTECTED_PREFIXES.some((prefix) => rel === prefix.slice(0, -1) || rel.startsWith(prefix));
}

function collectReferences() {
  const refs = new Set();

  function addAssetPaths(text) {
    for (const m of text.matchAll(
      /assets\/[a-zA-Z0-9_./\- %]+\.(?:png|jpe?g|gif|webp|svg)/gi,
    )) {
      refs.add(m[0].replace(/\\/g, "/"));
    }
    for (const m of text.matchAll(
      /story-site\/(assets\/[a-zA-Z0-9_./\- %]+\.(?:png|jpe?g|gif|webp|svg))/gi,
    )) {
      refs.add(m[1].replace(/\\/g, "/"));
    }
  }

  function addRootRelativePaths(text) {
    for (const m of text.matchAll(
      /(?:href|src|content)=["'](?!https?:\/\/)([^"']+\.(?:png|jpe?g|gif|webp|svg))(?:\?[^"']*)?["']/gi,
    )) {
      const raw = m[1].replace(/\\/g, "/");
      if (raw.startsWith("assets/")) refs.add(raw);
      else if (!raw.includes("/")) refs.add(raw);
      else if (raw.startsWith("./")) refs.add(raw.slice(2));
    }
  }

  for (const rel of SITE_FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, "utf8");
    addAssetPaths(text);
    addRootRelativePaths(text);
  }

  for (const htmlDir of ["share", "stats"]) {
    const dir = path.join(ROOT, htmlDir);
    if (!fs.existsSync(dir)) continue;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!ent.isFile() || !ent.name.endsWith(".html")) continue;
      const text = fs.readFileSync(path.join(dir, ent.name), "utf8");
      addAssetPaths(text);
      addRootRelativePaths(text);
    }
  }

  for (const ent of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith(".html")) continue;
    const text = fs.readFileSync(path.join(ROOT, ent.name), "utf8");
    addAssetPaths(text);
    addRootRelativePaths(text);
  }

  return refs;
}

function uniquePath(destDir, base) {
  let p = path.join(destDir, base);
  if (!fs.existsSync(p)) return p;
  const ext = path.extname(base);
  const stem = base.slice(0, -ext.length);
  let n = 1;
  while (fs.existsSync(path.join(destDir, `${stem}__dup${n}${ext}`))) n++;
  return path.join(destDir, `${stem}__dup${n}${ext}`);
}

function* walkImages(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === ".DS_Store") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_WALK_DIRS.has(ent.name)) continue;
      yield* walkImages(full);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (IMAGE_EXT.has(ext)) yield full;
    }
  }
}

function pruneEmpty(dir) {
  if (!fs.existsSync(dir) || dir === ROOT) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) pruneEmpty(path.join(dir, ent.name));
  }
  try {
    const left = fs.readdirSync(dir);
    if (left.length === 0) fs.rmdirSync(dir);
  } catch {
    /* ignore */
  }
}

const dryRun = process.argv.includes("--dry-run");
const refs = collectReferences();

const toMove = [];
for (const abs of walkImages(ROOT)) {
  const rel = toPosix(path.relative(ROOT, abs));
  if (isProtectedRel(rel)) continue;
  if (refs.has(rel)) continue;
  toMove.push({ abs, rel });
}

toMove.sort((a, b) => a.rel.localeCompare(b.rel));

console.error(`References: ${refs.size}`);
console.error(`Candidates to move: ${toMove.length}`);

if (dryRun) {
  for (const { rel } of toMove) console.log(rel);
  process.exit(0);
}

fs.mkdirSync(DEST, { recursive: true });

let moved = 0;
for (const { abs, rel } of toMove) {
  const flat = rel.split("/").join("__");
  const destAbs = uniquePath(DEST, flat);
  fs.renameSync(abs, destAbs);
  console.error(`${rel} -> bad/${path.basename(destAbs)}`);
  moved++;
}

for (const dir of ["assets/scenes", "assets/characters", "assets/covers", "assets"]) {
  pruneEmpty(path.join(ROOT, dir));
}

console.error(`Moved ${moved} unreferenced images to bad/`);
