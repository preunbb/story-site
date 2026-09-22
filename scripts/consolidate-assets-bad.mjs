// Consolidates unfiled_bad and per-category bad/ folders into assets/bad/.
// Flattens names as path-from-assets with path segments joined by __.
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ASSETS = path.join(ROOT, "assets");
const CANON = path.join(ASSETS, "bad");

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

const SOURCE_ROOTS = [
  path.join(ASSETS, "unfiled_bad"),
  path.join(ASSETS, "characters", "bad"),
  path.join(ASSETS, "covers", "bad"),
  path.join(ASSETS, "art", "bad"),
  path.join(ASSETS, "symbols", "bad"),
];

function toPosix(p) {
  return p.split(path.sep).join("/");
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

function* walkImageFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name === ".DS_Store") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walkImageFiles(full);
    else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (IMAGE_EXT.has(ext)) yield full;
    }
  }
}

function pruneEmpty(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) pruneEmpty(path.join(dir, ent.name));
  }
  try {
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch {
    /* ignore */
  }
}

fs.mkdirSync(CANON, { recursive: true });

let moved = 0;
for (const sourceRoot of SOURCE_ROOTS) {
  for (const abs of walkImageFiles(sourceRoot)) {
    const relFromAssets = toPosix(path.relative(ASSETS, abs));
    const flat = relFromAssets.split("/").join("__");
    const destAbs = uniquePath(CANON, flat);
    fs.renameSync(abs, destAbs);
    console.error(`${relFromAssets} -> bad/${path.basename(destAbs)}`);
    moved++;
  }
}

for (const sourceRoot of SOURCE_ROOTS) pruneEmpty(sourceRoot);

console.error(`Consolidated ${moved} files into assets/bad.`);
