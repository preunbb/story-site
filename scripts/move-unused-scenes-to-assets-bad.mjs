/**
 * Moves every file under assets/scenes/ not referenced by stories (cover / coverFlip / path)
 * into assets/bad/ as assets/bad/<relative-from-scenes-with-__>.ext
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCENES_ROOT = path.join(ROOT, "assets", "scenes");
const DEST_ROOT = path.join(ROOT, "assets", "bad");

const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
]);

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function collectSceneRefs() {
  const refs = new Set();
  const text = fs.readFileSync(path.join(ROOT, "data/stories.js"), "utf8");
  for (const m of text.matchAll(
    /(?:cover|coverFlip|path):\s*"([^"]+)"/g,
  )) {
    const v = m[1];
    if (v.startsWith("assets/scenes/")) refs.add(v);
  }
  return refs;
}

/** @param {string} destDir */
function uniquePath(destDir, base) {
  let p = path.join(destDir, base);
  if (!fs.existsSync(p)) return p;
  const ext = path.extname(base);
  const stem = base.slice(0, -ext.length);
  let n = 1;
  while (fs.existsSync(path.join(destDir, `${stem}__dup${n}${ext}`))) n++;
  return path.join(destDir, `${stem}__dup${n}${ext}`);
}

function* walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name === ".DS_Store") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walkFiles(full);
    else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (IMAGE_EXT.has(ext)) yield full;
    }
  }
}

function pruneEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    pruneEmptyDirs(path.join(dir, ent.name));
  }
  const after = fs.readdirSync(dir);
  if (after.length === 0 && dir !== SCENES_ROOT) {
    fs.rmdirSync(dir);
  }
}

const refs = collectSceneRefs();
fs.mkdirSync(DEST_ROOT, { recursive: true });

let moved = 0;
for (const abs of walkFiles(SCENES_ROOT)) {
  const rel = toPosix(path.relative(ROOT, abs));
  if (refs.has(rel)) continue;

  const underScenes = toPosix(path.relative(SCENES_ROOT, abs));
  const flat = underScenes.split("/").join("__");

  const destAbs = uniquePath(DEST_ROOT, flat);
  fs.renameSync(abs, destAbs);
  console.error(`${rel} -> ${toPosix(path.relative(ROOT, destAbs))}`);
  moved++;
}

pruneEmptyDirs(SCENES_ROOT);

console.error(`Moved ${moved} unused scene files to assets/bad.`);
