/**
 * Password-gated chapters use the same scheme as full-story unlocks:
 * SHA-256(gateDomain + password) is the public check, and
 * SHA-256(keyDomain + password) is the AES-256-GCM key for the chapter body.
 * Plaintext stays in gitignored dist/. The public markdown keeps the heading.
 */

import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const HEADING_RE = /^#{1,3} /;

export function isMarkdownChapterHeadingLine(line) {
  return HEADING_RE.test(String(line).trim());
}

/**
 * Drop the bodies of the given 1-based chapter indexes. Headings stay.
 * `chapters` maps those indexes to the removed body (may be empty).
 */
export function redactPasswordChapterBodies(markdown, oneBasedChapters) {
  const wanted = new Set(
    (oneBasedChapters || [])
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0),
  );
  const lines = String(markdown ?? "").split("\n");
  const publicLines = [];
  const bodies = {};
  let chapter = 0;
  let skipping = false;
  let bodyLines = null;

  function closeBody() {
    if (!skipping || chapter < 1) return;
    bodies[chapter] = (bodyLines || []).join("\n").replace(/^\n+/, "").replace(/\s+$/, "");
  }

  for (const line of lines) {
    if (isMarkdownChapterHeadingLine(line)) {
      const wasSkipping = skipping;
      closeBody();
      chapter += 1;
      skipping = wanted.has(chapter);
      bodyLines = skipping ? [] : null;
      if (
        wasSkipping &&
        publicLines.length &&
        publicLines[publicLines.length - 1] !== ""
      ) {
        publicLines.push("");
      }
      publicLines.push(line);
    } else if (skipping) {
      bodyLines.push(line);
    } else {
      publicLines.push(line);
    }
  }
  closeBody();

  let out = publicLines.join("\n");
  if (String(markdown ?? "").endsWith("\n") && !out.endsWith("\n")) out += "\n";
  return { markdown: out, chapters: bodies };
}

export function passwordChapterPlaintextPath(repoRoot, storyId, chapter) {
  return join(
    repoRoot,
    "dist",
    "password-chapters",
    `${storyId}-ch${chapter}.md`,
  );
}

export function sha256Utf8(text) {
  return createHash("sha256").update(text, "utf8").digest();
}

export function encryptChapterPlaintext(plaintext, password, keyDomain, gateDomain) {
  const key = sha256Utf8(keyDomain + password);
  const gateHash = sha256Utf8(gateDomain + password).toString("hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    gateHash,
    payload: {
      v: 1,
      alg: "AES-256-GCM",
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    },
  };
}

/**
 * Keep gated chapter bodies out of the public markdown. Writes gitignored
 * plaintext under dist/password-chapters/ and, when `passwordEnv` is set,
 * refreshes the committed ciphertext. The gate hash is not rewritten here.
 */
export function stashPasswordChapters(repoRoot, story, fullMarkdown, env = process.env) {
  const gates = Array.isArray(story?.passwordChapters) ? story.passwordChapters : [];
  if (!gates.length) return fullMarkdown;

  const { markdown, chapters } = redactPasswordChapterBodies(
    fullMarkdown,
    gates.map((gate) => gate.chapter),
  );

  for (const gate of gates) {
    const chapter = Number(gate.chapter);
    let body = chapters[chapter];
    const plainPath = passwordChapterPlaintextPath(repoRoot, story.id, chapter);
    if (body && body.trim()) {
      mkdirSync(dirname(plainPath), { recursive: true });
      body = body.replace(/^\n+/, "").replace(/\s+$/, "") + "\n";
      writeFileSync(plainPath, body, "utf8");
    } else if (existsSync(plainPath)) {
      body = readFileSync(plainPath, "utf8");
    } else {
      console.warn(
        `[password-chapters] #${story.id} has no plaintext for chapter ${chapter}`,
      );
      continue;
    }

    const password = gate.passwordEnv ? env[gate.passwordEnv]?.trim() : "";
    if (!password) {
      console.warn(
        `[password-chapters] #${story.id} ch ${chapter}: set ${gate.passwordEnv || "the reader password"} to refresh ciphertext`,
      );
      continue;
    }
    if (!gate.ciphertext || !gate.passwordKeyDomain || !gate.passwordGateDomain) {
      console.warn(
        `[password-chapters] #${story.id} ch ${chapter}: missing ciphertext or domains`,
      );
      continue;
    }
    const { gateHash, payload } = encryptChapterPlaintext(
      body,
      password,
      gate.passwordKeyDomain,
      gate.passwordGateDomain,
    );
    const outPath = join(repoRoot, gate.ciphertext);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(payload) + "\n", "utf8");
    if (gate.passwordGateHash && gate.passwordGateHash !== gateHash) {
      console.warn(
        `[password-chapters] #${story.id} ch ${chapter} passwordGateHash does not match. Paste into data/stories.js:\n${gateHash}`,
      );
    } else {
      console.log(
        `[password-chapters] #${story.id} ch ${chapter}: wrote ${gate.ciphertext}`,
      );
    }
  }

  return markdown;
}
