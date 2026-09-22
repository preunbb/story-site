#!/usr/bin/env node
/**
 * Encrypt the Andrea & Lucas complete manuscript for client-side unlock.
 *
 * Input (plaintext, never committed):
 *   dist/andrea-and-lucas-complete/story.md
 *   ANDREA_LUCAS_READER_PASSWORD in env / .env.local
 *
 * Output (safe to commit):
 *   assets/stories/andrea-and-lucas.enc.json
 *   prints passwordGateHash for data/stories.js
 *
 * Key material is domain-separated from the gate hash so committing the
 * gate hash does not publish the AES key.
 *
 * Usage: npm run encrypt:andrea-lucas
 */

import { createHash, createCipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./lib/load-env-local.mjs";
import { stripGoogleDocsFrontMatter } from "./lib/andrea-lucas-export.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const GATE_DOMAIN = "story-site:andrea-lucas:gate:";
const KEY_DOMAIN = "story-site:andrea-lucas:key:";
const INPUT_MD = join(REPO_ROOT, "dist", "andrea-and-lucas-complete", "story.md");
const OUT_PATH = join(
  REPO_ROOT,
  "assets",
  "stories",
  "andrea-and-lucas.enc.json",
);

loadEnvLocal(REPO_ROOT);

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(
      `Missing ${name}. Add it to .env.local (gitignored) or the environment.`,
    );
    process.exit(1);
  }
  return value;
}

function sha256Utf8(text) {
  return createHash("sha256").update(text, "utf8").digest();
}

function main() {
  const password = requireEnv("ANDREA_LUCAS_READER_PASSWORD");
  if (!existsSync(INPUT_MD)) {
    console.error(
      `Missing ${INPUT_MD}\nRun: npm run sync:andrea-complete`,
    );
    process.exit(1);
  }

  const plaintext = Buffer.from(
    stripGoogleDocsFrontMatter(readFileSync(INPUT_MD, "utf8")),
    "utf8",
  );
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

  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Bytes plaintext: ${plaintext.length}`);
  console.log(
    `passwordGateHash (paste into DATA_ANDREA_LUCAS_FULL in data/stories.js):\n${gateHash}`,
  );
}

main();
