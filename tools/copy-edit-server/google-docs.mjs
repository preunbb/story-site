import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TOKEN_PATH = join(__dirname, ".google-docs-token.json");
const SCOPES = ["https://www.googleapis.com/auth/documents"];

export function loadCredentials() {
  const envPath = process.env.GOOGLE_OAUTH_CREDENTIALS;
  const path = envPath || join(__dirname, "credentials.json");
  if (!existsSync(path)) {
    return {
      error: `Missing OAuth client file. Place credentials.json in tools/copy-edit-server/ or set GOOGLE_OAUTH_CREDENTIALS. Create a Desktop OAuth client in Google Cloud Console and enable the Google Docs API.`,
      path,
    };
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const creds = raw.installed || raw.web;
  if (!creds?.client_id || !creds?.client_secret) {
    return { error: "credentials.json must contain installed or web client_id/client_secret", path };
  }
  return { creds, path };
}

/**
 * @param {number} port - server port for OAuth redirect
 */
export function makeOAuth2Client(port) {
  const loaded = loadCredentials();
  if (loaded.error) throw new Error(loaded.error);
  const { creds } = loaded;
  const redirectUri =
    creds.redirect_uris?.find((u) => u.includes("127.0.0.1")) ||
    `http://127.0.0.1:${port}/oauth2callback`;
  return new OAuth2Client({
    clientId: creds.client_id,
    clientSecret: creds.client_secret,
    redirectUri,
  });
}

export function loadSavedCredentials() {
  if (!existsSync(TOKEN_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function saveCredentials(token) {
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), "utf8");
}

export function getAuthorizedClient(port) {
  const client = makeOAuth2Client(port);
  const tok = loadSavedCredentials();
  if (tok) {
    client.setCredentials(tok);
    return client;
  }
  return null;
}

export function authUrl(client) {
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

/**
 * Apply literal substring replacements (Docs replaceAllText). Longest `before`
 * runs first to reduce accidental partial overlaps.
 * @param {OAuth2Client} auth
 * @param {string} documentId
 * @param {{ before: string, after: string }[]} edits
 */
export async function batchReplaceAllText(auth, documentId, edits) {
  const docs = google.docs({ version: "v1", auth });
  const sorted = [...edits].filter((e) => e.before && e.before !== e.after).sort(
    (a, b) => b.before.length - a.before.length,
  );
  const matchCase = process.env.COPY_EDIT_DOCS_MATCH_CASE !== "false";
  const requests = sorted.map(({ before, after }) => ({
    replaceAllText: {
      containsText: {
        text: before,
        matchCase,
      },
      replaceText: after,
    },
  }));
  if (!requests.length) return { replacements: 0 };
  await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests },
  });
  return { replacements: requests.length };
}
