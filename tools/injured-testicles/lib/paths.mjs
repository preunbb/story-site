import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const REFERENCE_IMAGE = "assets/brands/healthy_veiny.png";
export const DEFAULT_OUTPUT_DIR = "assets/over-easy/brands";

/**
 * @param {string} repoRoot
 * @param {string} relative
 */
export function assetExists(repoRoot, relative) {
  return existsSync(join(repoRoot, relative));
}

/**
 * @param {string} repoRoot
 * @param {string} outputDir relative to repo root
 * @param {string} stem e.g. healthy_veiny_punctured
 */
export function nextVersion(repoRoot, outputDir, stem) {
  const dir = join(repoRoot, outputDir);
  if (!existsSync(dir)) return 1;

  const pattern = new RegExp(
    `^${escapeRegExp(stem)}_v(\\d+)\\.png$`,
    "i"
  );
  let max = 0;
  for (const name of readdirSync(dir)) {
    const m = name.match(pattern);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** @param {string} s */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} injurySlug
 * @param {number} version
 */
export function buildFilename(injurySlug, version) {
  const stem = injurySlug
    ? `healthy_veiny_${injurySlug}`
    : "healthy_veiny_injured";
  return `${stem}_v${version}.png`;
}
