#!/usr/bin/env node
/**
 * Encrypt Mother Knows Best (story #60) for client-side beta unlock.
 *
 * Input: assets/stories/60.md (gitignored; run `npm run sync -- --only=60` first)
 * Output: assets/stories/mother-knows-best.enc.json
 *
 * Usage: MOTHER_KNOWS_BEST_READER_PASSWORD=beta node scripts/encrypt-mother-knows-best.mjs
 */

import { createHash, createCipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const GATE_DOMAIN = "story-site:mother-knows-best:gate:";
const KEY_DOMAIN = "story-site:mother-knows-best:key:";
const INPUT_MD = join(REPO_ROOT, "assets", "stories", "60.md");
const OUT_PATH = join(REPO_ROOT, "assets", "stories", "mother-knows-best.enc.json");

function sha256Utf8(text) {
  return createHash("sha256").update(text, "utf8").digest();
}

function main() {
  const password = (process.env.MOTHER_KNOWS_BEST_READER_PASSWORD || "beta").trim();
  if (!password) {
    console.error("Missing MOTHER_KNOWS_BEST_READER_PASSWORD");
    process.exit(1);
  }
  if (!existsSync(INPUT_MD)) {
    console.error(`Missing ${INPUT_MD}\nRun: node scripts/sync-stories.mjs --only=60`);
    process.exit(1);
  }

  const plaintext = Buffer.from(readFileSync(INPUT_MD, "utf8"), "utf8");
  const key = sha256Utf8(KEY_DOMAIN + password);
  const gateHash = sha256Utf8(GATE_DOMAIN + password).toString("hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = {
    v: 1,
    alg: "AES-256-GCM",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(payload) + "\n", "utf8");

  console.log("Wrote", OUT_PATH);
  console.log("passwordGateHash:", gateHash);
  console.log("passwordGateDomain:", GATE_DOMAIN);
  console.log("passwordKeyDomain:", KEY_DOMAIN);
}

main();