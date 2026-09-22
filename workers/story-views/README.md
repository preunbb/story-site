# Story reader view counter (Cloudflare Worker)

Static hosts (e.g. GitHub Pages) cannot accept `POST` from the browser to “append a line to a text file.” You need **some** serverless endpoint. This Worker stores **one count per UTC calendar day × story id** in Workers KV.

## What the site sends

When someone opens the story reader, `script.js` POSTs JSON to `ingestUrl`:

```json
{ "storyId": 25 }
```

## One-time setup

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) and log in: `npx wrangler login`

2. Create a KV namespace and put its id in `wrangler.toml` (replace `REPLACE_ME_AFTER_kv_namespace_create`):

   ```bash
   cd workers/story-views
   npx wrangler kv namespace create VIEWS
   ```

3. Set a secret used only when **you** download stats (not sent by the public site):

   ```bash
   npx wrangler secret put STATS_SECRET
   ```

4. Edit `wrangler.toml` `[vars] ALLOWED_ORIGINS` if your site’s origin is different (exact `Origin` header values, comma-separated).

5. Deploy:

   ```bash
   npx wrangler deploy
   ```

6. In `data/analytics.js` set:

   ```js
   ingestUrl: "https://story-site-story-views.<your-subdomain>.workers.dev/v1/hit",
   ```

   Commit and publish the site.

## Get a JSON blob for graphs

```text
GET https://<worker-host>/v1/stats?secret=<STATS_SECRET>
```

Response shape:

```json
{
  "byDay": {
    "2026-05-17": { "25": 4, "1": 12 },
    "2026-05-18": { "25": 1 }
  },
  "days": ["2026-05-17", "2026-05-18"]
}
```

Import `byDay` into a spreadsheet or chart tool, or graph in a notebook.

## Notes

- Counts are **UTC** dates (`v:YYYY-MM-DD:<storyId>`).
- CORS only allows `Origin` values listed in `ALLOWED_ORIGINS`.
- **Not** a substitute for privacy-preserving product analytics; this is a minimal DIY counter.
