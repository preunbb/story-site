/**
 * Local-only copy-editing UI for Drive-backed stories.
 * Binds to 127.0.0.1 only. Requires OPENAI_API_KEY and Google OAuth (credentials.json).
 */

import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";

import {
  makeTurndown,
  fetchMarkdownFromPublishUrl,
} from "../../scripts/lib/published-doc-markdown.mjs";

import {
  authUrl,
  getAuthorizedClient,
  loadCredentials,
  makeOAuth2Client,
  saveCredentials,
  batchReplaceAllText,
} from "./google-docs.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const STORIES_JS = join(REPO_ROOT, "data", "stories.js");
const DRIVE_IDS_JSON = join(REPO_ROOT, "dist", "drive_doc_ids.json");

const PORT = Number(process.env.COPY_EDIT_PORT || 8742);
const HOST = "127.0.0.1";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_URL =
  process.env.OPENAI_BASE_URL?.replace(/\/$/, "") || "https://api.openai.com/v1";
const DRIVE_IDS_PRESENT = existsSync(DRIVE_IDS_JSON);

function loadStories() {
  const code = readFileSync(STORIES_JS, "utf8");
  const sandbox = { window: {} };
  createContext(sandbox);
  new Script(code, { filename: "data/stories.js" }).runInContext(sandbox);
  const stories = sandbox.window.DATA_STORIES;
  if (!Array.isArray(stories)) {
    throw new Error("data/stories.js did not populate window.DATA_STORIES");
  }
  return stories;
}

function loadDriveMappingsByTitle() {
  const map = new Map();
  if (!existsSync(DRIVE_IDS_JSON)) return map;
  try {
    const j = JSON.parse(readFileSync(DRIVE_IDS_JSON, "utf8"));
    for (const row of j.mappings || []) {
      if (row.story_title && row.drive_doc_id) {
        map.set(row.story_title, row.drive_doc_id);
      }
    }
  } catch {
    /* ignore */
  }
  return map;
}

/**
 * @param {string} markdown
 * @returns {{ index: number, title: string, body: string }[]}
 */
function splitIntoChapters(markdown) {
  const md = markdown.replace(/\r\n/g, "\n");
  const chunks = md.split(/(?=^#{1,6}\s+)/m).filter((c) => c.trim().length);
  return chunks.map((chunk, index) => {
    const lines = chunk.trimEnd().split("\n");
    const first = lines[0] ?? "";
    const hm = first.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      return {
        index,
        title: hm[2].trim(),
        body: lines.slice(1).join("\n").trim(),
      };
    }
    return {
      index,
      title: "Full story",
      body: chunk.trim(),
    };
  });
}

async function analyzeChapter(chapterTitle, chapterBody) {
  if (!OPENAI_KEY) {
    throw new Error("Set OPENAI_API_KEY in the environment before analyzing chapters.");
  }
  const system = `You are a meticulous copy editor for fiction. Find objective typos, misspellings, missing words, wrong words, and clear grammatical mistakes (subject-verb agreement, doubled words, wrong apostrophes, etc.).

Rules:
- ONLY flag text that is objectively wrong or inconsistent standard English. Do NOT rewrite for taste, voice, or stylistic "improvement."
- Catalog vocabulary is valid — never flag as misspellings: halfstration (halfstrated), nutmeat, nutpain, ballpain, ballache, ballsack, testeria.
- Style preferences (flag these when editing): prefer step-sister over stepsister or step sister; prefer okay over ok; spell out numbers one through ten in prose (digits OK for ages, dates, times, measurements).
- The chapter text is Markdown exported from a published Google Doc (italics may appear as *words*). Fixes will be applied with Google Docs "replace all" on the **underlying Doc**, which does NOT contain asterisk markers for italics.
- For each issue, "before" and "after" must describe only the **visible prose** — omit surrounding * or ** markers unless the actual typo is inside the marker characters themselves.
- Use straight ASCII apostrophes/quotes in "before"/"after" unless the snippet clearly uses curly punctuation.
- "before" must be copied verbatim from the readable wording in the chapter (after mentally stripping markdown emphasis markers). It must be long enough to be UNIQUE within this chapter.
- "after" replaces exactly that span.
- Skip lines that are only [[scene:id]] tags.
- If there are no issues, return an empty issues array.

Respond with JSON only: { "issues": [ { "before": "...", "after": "...", "reason": "short label" } ] }`;

  const user = `Chapter title: ${chapterTitle}\n\n---\n\n${chapterBody}`;

  const res = await fetch(`${OPENAI_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${t.slice(0, 500)}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty model response");
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Model returned non-JSON");
  }
  const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
  const cleaned = issues
    .filter((x) => x && typeof x.before === "string" && typeof x.after === "string")
    .map((x, i) => ({
      id: `i${i}`,
      before: x.before,
      after: x.after,
      reason: typeof x.reason === "string" ? x.reason : "",
    }));

  for (const issue of cleaned) {
    if (!chapterBody.includes(issue.before)) {
      issue.warning =
        '"before" text was not found verbatim in this chapter — applying to Drive may fail.';
    }
  }
  return cleaned;
}

const td = makeTurndown();
const driveByTitle = loadDriveMappingsByTitle();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  const cred = loadCredentials();
  res.json({
    ok: true,
    openai: Boolean(OPENAI_KEY),
    googleCredentialsOk: !cred.error,
    googleTokenSaved: existsSync(join(__dirname, ".google-docs-token.json")),
  });
});

app.get("/api/google/status", (_req, res) => {
  const cred = loadCredentials();
  res.json({
    credentialsOk: !cred.error,
    credentialsPath: cred.path,
    credentialsError: cred.error || null,
    tokenSaved: Boolean(existsSync(join(__dirname, ".google-docs-token.json"))),
  });
});

app.get("/api/google/start", (_req, res) => {
  try {
    const client = makeOAuth2Client(PORT);
    res.redirect(authUrl(client));
  } catch (e) {
    res.status(500).send(`<pre>${String(e.message)}</pre>`);
  }
});

app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  if (!code || typeof code !== "string") {
    res.status(400).send("Missing code");
    return;
  }
  try {
    const client = makeOAuth2Client(PORT);
    const { tokens } = await client.getToken(code);
    saveCredentials(tokens);
    res.redirect("/");
  } catch (e) {
    res.status(500).send(`<pre>OAuth error: ${String(e.message)}</pre>`);
  }
});

app.get("/api/stories", (_req, res) => {
  try {
    const stories = loadStories();
    const rows = stories.map((s, rowIndex) => ({
      rowIndex,
      id: s.id,
      title: s.title,
      driveUrl: s.driveUrl || null,
      driveDocId: s.title ? driveByTitle.get(s.title) ?? null : null,
    }));
    res.json({ stories: rows });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.get("/api/story/:rowIndex/outline", async (req, res) => {
  const rowIndex = Number(req.params.rowIndex);
  const stories = loadStories();
  const story = stories[rowIndex];
  if (!story) {
    res.status(404).json({ error: "Story not found" });
    return;
  }
  if (!story.driveUrl) {
    res.status(400).json({ error: "Story has no driveUrl" });
    return;
  }
  try {
    const markdown = await fetchMarkdownFromPublishUrl(story.driveUrl, td);
    const chapters = splitIntoChapters(markdown);
    res.json({
      id: story.id,
      title: story.title,
      driveUrl: story.driveUrl,
      driveDocId: driveByTitle.get(story.title) ?? null,
      chapters: chapters.map((c) => ({
        index: c.index,
        title: c.title,
        wordCount: c.body.trim() ? c.body.trim().split(/\s+/).length : 0,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.post("/api/story/:rowIndex/chapter/:chapterIndex/analyze", async (req, res) => {
  const rowIndex = Number(req.params.rowIndex);
  const chapterIndex = Number(req.params.chapterIndex);
  const stories = loadStories();
  const story = stories[rowIndex];
  if (!story?.driveUrl) {
    res.status(404).json({ error: "Story not found or no driveUrl" });
    return;
  }
  try {
    const markdown = await fetchMarkdownFromPublishUrl(story.driveUrl, td);
    const chapters = splitIntoChapters(markdown);
    const ch = chapters.find((c) => c.index === chapterIndex);
    if (!ch) {
      res.status(404).json({ error: "Chapter not found" });
      return;
    }
    const issues = await analyzeChapter(ch.title, ch.body);
    res.json({
      chapterTitle: ch.title,
      chapterIndex: ch.index,
      issues,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.post("/api/story/:rowIndex/apply", async (req, res) => {
  const rowIndex = Number(req.params.rowIndex);
  const stories = loadStories();
  const story = stories[rowIndex];
  if (!story) {
    res.status(404).json({ error: "Story not found" });
    return;
  }
  const docId = driveByTitle.get(story.title);
  if (!docId) {
    res.status(400).json({
      error:
        "No drive_doc_id for this story title. Ensure dist/drive_doc_ids.json exists and includes this story.",
    });
    return;
  }
  const edits = req.body?.edits;
  if (!Array.isArray(edits) || !edits.every((e) => e && typeof e.before === "string" && typeof e.after === "string")) {
    res.status(400).json({ error: 'Body must be { edits: [{ before, after }] }' });
    return;
  }
  const auth = getAuthorizedClient(PORT);
  if (!auth) {
    res.status(401).json({
      error: "Not authorized. Open /api/google/start in your browser to connect Google.",
    });
    return;
  }
  try {
    const result = await batchReplaceAllText(auth, docId, edits);
    res.json({ ok: true, documentId: docId, ...result });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`
Copy-edit server (localhost only)
  URL:    http://${HOST}:${PORT}
  OpenAI: ${OPENAI_KEY ? `enabled (${OPENAI_MODEL})` : "DISABLED — set OPENAI_API_KEY"}
  Drive:  ${loadCredentials().error ? "credentials missing — see console" : "credentials.json OK"}
  OAuth:  http://${HOST}:${PORT}/api/google/start
  Doc IDs: ${DRIVE_IDS_PRESENT ? DRIVE_IDS_JSON : "MISSING — dist/drive_doc_ids.json not found; edits need doc IDs"}
`);
});
