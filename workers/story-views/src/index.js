/**
 * Counts POST /v1/hit { "storyId": number } into KV keys v:<UTC-date>:<storyId>.
 * GET /v1/stats?secret=... returns JSON for homemade graphs (see README).
 */

function corsHeaders(allowOrigin) {
  const h = {
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (allowOrigin) {
    h["Access-Control-Allow-Origin"] = allowOrigin;
    h.Vary = "Origin";
  }
  return h;
}

function parseAllowedOrigins(env) {
  const raw = env.ALLOWED_ORIGINS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchOrigin(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = parseAllowedOrigins(env);
  if (!origin) return null;
  return allowed.includes(origin) ? origin : null;
}

function utcDateString() {
  return new Date().toISOString().slice(0, 10);
}

function jsonResponse(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (request.method === "OPTIONS" && path === "/v1/hit") {
      const origin = matchOrigin(request, env);
      if (!origin) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method === "POST" && path === "/v1/hit") {
      const origin = matchOrigin(request, env);
      if (!origin) {
        return jsonResponse({ error: "forbidden" }, 403);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "invalid_json" }, 400, corsHeaders(origin));
      }

      const storyId = Number(body && body.storyId);
      if (!Number.isFinite(storyId) || storyId < 0 || storyId > 1e9) {
        return jsonResponse({ error: "bad_story_id" }, 400, corsHeaders(origin));
      }

      const sid = String(Math.trunc(storyId));
      const key = `v:${utcDateString()}:${sid}`;

      const cur = parseInt((await env.VIEWS.get(key)) || "0", 10);
      await env.VIEWS.put(key, String(cur + 1));

      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (request.method === "GET" && path === "/v1/stats") {
      const secret = env.STATS_SECRET;
      if (!secret || url.searchParams.get("secret") !== secret) {
        return jsonResponse({ error: "unauthorized" }, 401);
      }

      const byDay = {};
      let cursor;
      for (;;) {
        const list = await env.VIEWS.list({ prefix: "v:", cursor, limit: 1000 });
        for (const meta of list.keys) {
          const m = /^v:(\d{4}-\d{2}-\d{2}):(\d+)$/.exec(meta.name);
          if (!m) continue;
          const [, day, id] = m;
          const count = parseInt((await env.VIEWS.get(meta.name)) || "0", 10);
          if (!byDay[day]) byDay[day] = {};
          byDay[day][id] = count;
        }
        if (list.list_complete || !list.cursor) break;
        cursor = list.cursor;
      }

      const days = Object.keys(byDay).sort();
      return jsonResponse({ byDay, days });
    }

    return jsonResponse({ error: "not_found" }, 404);
  },
};
