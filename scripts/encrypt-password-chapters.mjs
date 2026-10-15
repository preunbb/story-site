#!/usr/bin/env node
/**
 * Refresh ciphertext for story.passwordChapters.
 *
 * Reads the public markdown (assets/stories/<id>.md). If a gated chapter body
 * is still in that file, it is extracted, the public file is rewritten without
 * it, and plaintext is saved under dist/password-chapters/ (gitignored).
 * If the public file is already redacted, plaintext is read from dist/.
 *
 * Password comes from each gate's passwordEnv in .env.local. Never commit it.
 *
 * Usage: npm run encrypt:password-chapters
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createContext, Script } from "node:vm";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./lib/load-env-local.mjs";
import {
  passwordChapterPlaintextPath,
  redactPasswordChapterBodies,
  stashPasswordChapters,
} from "./lib/password-chapters.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

loadEnvLocal(repoRoot);

function loadStories() {
  const code = readFileSync(join(repoRoot, "data", "stories.js"), "utf8");
  const sandbox = { window: {} };
  createContext(sandbox);
  new Script(code, { filename: "data/stories.js" }).runInContext(sandbox);
  const stories = sandbox.window.DATA_STORIES;
  if (!Array.isArray(stories)) {
    throw new Error("data/stories.js did not populate window.DATA_STORIES");
  }
  return stories;
}

function ensurePlaintextAvailable(story) {
  const mdPath = join(repoRoot, "assets", "stories", `${story.id}.md`);
  if (!existsSync(mdPath)) {
    throw new Error(`Missing ${mdPath}`);
  }
  const markdown = readFileSync(mdPath, "utf8");
  const gates = story.passwordChapters;
  const extracted = redactPasswordChapterBodies(
    markdown,
    gates.map((gate) => gate.chapter),
  );
  const missing = [];
  for (const gate of gates) {
    const chapter = Number(gate.chapter);
    const fromPublic = extracted.chapters[chapter];
    if (fromPublic && fromPublic.trim()) continue;
    const plainPath = passwordChapterPlaintextPath(repoRoot, story.id, chapter);
    if (!existsSync(plainPath)) missing.push(chapter);
  }
  if (missing.length) {
    throw new Error(
      `#${story.id} is missing plaintext for chapter(s) ${missing.join(", ")}. Sync from Drive first.`,
    );
  }
  const publicMd = stashPasswordChapters(repoRoot, story, markdown);
  if (publicMd !== markdown) {
    writeFileSync(mdPath, publicMd, "utf8");
    console.log(`[password-chapters] redacted assets/stories/${story.id}.md`);
  }
}

function main() {
  const stories = loadStories().filter(
    (story) => Array.isArray(story.passwordChapters) && story.passwordChapters.length,
  );
  if (!stories.length) {
    console.log("No passwordChapters entries in data/stories.js.");
    return;
  }
  for (const story of stories) {
    ensurePlaintextAvailable(story);
  }
}

main();
