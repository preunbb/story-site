#!/usr/bin/env node
/**
 * Pull Bereavement Counseling from its published Google Doc into
 * dist/bereavement-counseling/ (markdown + SOURCE.json). dist/ is gitignored.
 *
 * Publish URL lives in .env.local (BEREAVEMENT_PUBLISH_URL) or falls back to
 * the driveUrl historically used for story id 49.
 *
 * Usage: npm run sync:bereavement
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./lib/load-env-local.mjs";
import {
  makeTurndown,
  fetchMarkdownFromPublishUrl,
} from "./lib/published-doc-markdown.mjs";
import { stripGoogleDocsFrontMatter } from "./lib/andrea-lucas-export.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

loadEnvLocal(REPO_ROOT);

const FALLBACK_PUBLISH_URL =
  "https://docs.google.com/document/d/e/2PACX-1vQvaHoeI871FaxJyLlR2MXUHfKNBG1yvbPVnA2N-LIn9HqEhHK8Sy64xpqh75XlDISXp2v_By3BRcrx/pub";

const PUBLISH_URL =
  process.env.BEREAVEMENT_PUBLISH_URL?.trim() || FALLBACK_PUBLISH_URL;
const EDIT_DOC_ID =
  process.env.BEREAVEMENT_EDIT_DOC_ID?.trim() ||
  "13fqdEIlbdHRQqaTURGuTn7VGROzq-B50npIPr-9H7WU";

const OUT_DIR = join(REPO_ROOT, "dist", "bereavement-counseling");

function countWords(md) {
  const t = md.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const td = makeTurndown();
  const md = stripGoogleDocsFrontMatter(
    await fetchMarkdownFromPublishUrl(PUBLISH_URL, td),
  );
  const words = countWords(md);
  const syncedAt = new Date().toISOString();

  writeFileSync(join(OUT_DIR, "story.md"), md, "utf8");
  writeFileSync(
    join(OUT_DIR, "SOURCE.json"),
    JSON.stringify(
      {
        title: "Bereavement Counseling: The Five Stages of Grieving a Testicle",
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

  console.log(`Wrote ${join(OUT_DIR, "story.md")} (${words} words)`);
  console.log(`Wrote ${join(OUT_DIR, "SOURCE.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
