#!/usr/bin/env node
/**
 * One-off archive: pulls the full "Andrea and Lucas" published Google Doc into
 * dist/andrea-and-lucas-complete/ (markdown + SOURCE.json).
 *
 * dist/ is gitignored — this snapshot is not tracked by git.
 *
 * After syncing, open http://localhost:8080/local-andrea-lucas.html (with
 * npm start) to read the manuscript in-browser. The main catalog "Ratings" tab
 * also appears only when SOURCE.json is present.
 *
 * Usage: node scripts/sync-andrea-lucas-complete-to-dist.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeTurndown,
  fetchMarkdownFromPublishUrl,
} from "./lib/published-doc-markdown.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

/** Editable Drive doc (see dist/drive_doc_ids.json for Part 1 / Part 2 mappings). */
const EDIT_DOC_ID = "1BpovDCzcee_DMzKcEP4t6f17KLm3vMIbecE7PDXZS68";
const PUBLISH_URL =
  "https://docs.google.com/document/d/e/2PACX-1vSrtvzgoGYWGYgg9a-y9YsyTJijnb_F4Hj2k9H5HFLI_wMKwwAn1b3LahTprIUMALrw2K_CCx-rtpoj/pub";

const OUT_DIR = join(REPO_ROOT, "dist", "andrea-and-lucas-complete");

function countWords(md) {
  const t = md.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const td = makeTurndown();
  const md = await fetchMarkdownFromPublishUrl(PUBLISH_URL, td);
  const words = countWords(md);
  const syncedAt = new Date().toISOString();

  writeFileSync(join(OUT_DIR, "story.md"), md, "utf8");
  writeFileSync(
    join(OUT_DIR, "SOURCE.json"),
    JSON.stringify(
      {
        title: "Andrea and Lucas",
        editDocId: EDIT_DOC_ID,
        editUrl: `https://docs.google.com/document/d/${EDIT_DOC_ID}/edit`,
        publishUrl: PUBLISH_URL,
        syncedAt,
        wordCount: words,
        bytes: Buffer.byteLength(md, "utf8"),
        source: "Google Docs → File → Publish to web (public)",
        outputFiles: ["story.md", "SOURCE.json"],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(`Wrote ${OUT_DIR}/`);
  console.log(`  story.md  (${words} words)`);
  console.log(`  SOURCE.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
