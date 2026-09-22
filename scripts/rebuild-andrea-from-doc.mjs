#!/usr/bin/env node
/*
 * Pull the canonical Andrea & Lucas Google Doc and rebuild every downstream
 * artifact: local complete manuscript, site preview markdown, publish PDFs/EPUB/covers.
 *
 * Usage:
 *   node scripts/rebuild-andrea-from-doc.mjs [--no-end-page]
 *   npm run rebuild:andrea-from-doc
 *
 * Steps:
 *   1. sync-andrea-lucas-complete-to-dist.mjs  → dist/andrea-and-lucas-complete/
 *   2. sync-andrea-part2-preview-md.mjs         → assets/stories/47-preview.md
 *   3. publish-andrea-lucas.mjs --skip-sync     → dist/andrea-lucas-published/
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

function parseArgs(argv) {
  return { endPage: !argv.includes("--no-end-page") };
}

function run(step, script, extraArgs = []) {
  console.log(`\n[rebuild:andrea-from-doc] ${step}`);
  const result = spawnSync(
    process.execPath,
    [resolve(repoRoot, "scripts", script), ...extraArgs],
    { cwd: repoRoot, stdio: "inherit" },
  );
  if (result.error) {
    throw new Error(`failed to run ${script}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${step} failed (exit ${result.status})`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const publishArgs = ["--skip-sync"];
  if (args.endPage) publishArgs.push("--end-page");

  console.log("[rebuild:andrea-from-doc] Starting full rebuild from Google Doc…");

  run(
    "1/3 — sync complete manuscript",
    "sync-andrea-lucas-complete-to-dist.mjs",
  );
  run(
    "2/3 — sync site preview (chapters 8–10)",
    "sync-andrea-part2-preview-md.mjs",
  );
  run("3/3 — publish PDFs, EPUB, covers", "publish-andrea-lucas.mjs", publishArgs);

  console.log("\n[rebuild:andrea-from-doc] done.");
  console.log("  dist/andrea-and-lucas-complete/story.md");
  console.log("  assets/stories/47-preview.md");
  console.log("  dist/andrea-lucas-published/ (Part 1 & 2 PDFs, EPUB, covers, manifest.json)");
}

try {
  main();
} catch (e) {
  console.error(`[rebuild:andrea-from-doc] ${e.message}`);
  process.exit(1);
}
