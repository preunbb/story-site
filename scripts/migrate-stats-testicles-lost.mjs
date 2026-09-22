#!/usr/bin/env node
/**
 * Rename pop metrics → testicles lost; migrate meta/manifest keys.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATS = path.join(ROOT, "stats");

/** slug → { total, sections?: Record<label, count> } overrides for surgical / infertility */
const COUNT_OVERRIDES = {
  "the-cult": { total: 2, sections: { "2 — Poly’s knife castration": 2 } },
  "the-internship": { total: 2, sections: { "2 — Stirrups procedure + aftermath": 2 } },
  testy: { total: 2, sections: { "1 — Steven's Big Exam": 1, "2 — At the Hospital": 1 } },
  postop: { total: 2, sections: { "Part 1": 2 } },
};

function migrateMeta(obj, slug) {
  if (obj.totalPops != null && obj.totalTesticlesLost == null) {
    obj.totalTesticlesLost = obj.totalPops;
  }
  delete obj.totalPops;
  const o = COUNT_OVERRIDES[slug];
  if (o) obj.totalTesticlesLost = o.total;
  return obj;
}

function updateReportText(text, slug) {
  text = text.replace(/## Pops and female orgasms/g, "## Testicles lost and female orgasms");
  text = text.replace(/\| Testicles popped \|/g, "| Testicles lost |");
  text = text.replace(/Per-chapter counts;/g, "Per-chapter counts;");
  text = text.replace(/Per-section counts;/g, "Per-section counts;");

  const o = COUNT_OVERRIDES[slug];
  if (!o?.sections) {
    if (o?.total != null) {
      text = text.replace(
        /\| \*\*Total\*\* \| \d+\+? \|/,
        `| **Total** | ${o.total} |`,
      );
    }
    return text;
  }

  for (const [label, count] of Object.entries(o.sections)) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(
      new RegExp(`(\\| \\*\\*${escaped}\\*\\* \\| )\\d+\\+?( \\|)`, "g"),
      `$1${count}$2`,
    );
  }
  text = text.replace(
    /\| \*\*Total\*\* \| \d+\+? \|/,
    `| **Total** | ${o.total} |`,
  );
  return text;
}

function updateStatusLabels(text) {
  return text
    .replace(/\*\*Removed \(surgical\)\*\*/g, "**Lost (surgical)**")
    .replace(/\*\*Popped \(offscreen\/surgical\)\*\*/g, "**Lost (offscreen/surgical)**");
}

for (const slug of fs.readdirSync(STATS)) {
  const dir = path.join(STATS, slug);
  if (!fs.statSync(dir).isDirectory()) continue;

  const metaPath = path.join(dir, "meta.json");
  if (fs.existsSync(metaPath)) {
    const meta = migrateMeta(JSON.parse(fs.readFileSync(metaPath, "utf8")), slug);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  }

  for (const f of fs.readdirSync(dir)) {
    if (!/^testicle-stats.*\.md$/.test(f)) continue;
    const p = path.join(dir, f);
    let t = fs.readFileSync(p, "utf8");
    t = updateStatusLabels(updateReportText(t, slug));
    fs.writeFileSync(p, t);
  }
}

// manifest.json
const manifestPath = path.join(STATS, "manifest.json");
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.totals?.totalPops != null) {
    manifest.totals.totalTesticlesLost = manifest.totals.totalPops;
    delete manifest.totals.totalPops;
  }
  manifest.reports = manifest.reports.map((r) => {
    const slug = r.slug;
    const next = { ...r };
    if (next.totalPops != null && next.totalTesticlesLost == null) {
      next.totalTesticlesLost = next.totalPops;
    }
    delete next.totalPops;
    const o = COUNT_OVERRIDES[slug];
    if (o) next.totalTesticlesLost = o.total;
    return next;
  });
  manifest.totals.totalTesticlesLost = manifest.reports.reduce(
    (s, r) => s + (r.totalTesticlesLost ?? 0),
    0,
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log("manifest totals:", manifest.totals);
}

console.log("Done migrating stats terminology.");
