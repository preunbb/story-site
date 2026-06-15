#!/usr/bin/env node
/**
 * Normalize stats reports to exactly two tables (+ notes.md sidecar).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATS_DIR = path.join(ROOT, "stats");

function findReportFile(slugDir) {
  const files = fs.readdirSync(slugDir).filter((f) => /^testicle-stats.*\.md$/.test(f));
  return files[0] || null;
}

function parseTableSection(text, headingPattern) {
  const headingRe = new RegExp(`^## ${headingPattern}`, "im");
  const match = text.match(headingRe);
  if (!match) return { header: [], rows: [] };

  const rest = text.slice(match.index + match[0].length);
  const tableStart = rest.search(/\n\|[^\n]+\|\n\|[-| :]+\|/);
  if (tableStart === -1) return { header: [], rows: [] };

  const lines = [];
  for (const line of rest.slice(tableStart + 1).split("\n")) {
    if (!line.startsWith("|")) break;
    lines.push(line);
  }
  if (lines.length < 2) return { header: [], rows: [] };

  const parseRow = (line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  return { header: parseRow(lines[0]), rows: lines.slice(2).map(parseRow) };
}

function normalizeKey(cell) {
  const k = cell.replace(/\*\*/g, "").trim();
  const ch = k.match(/^Ch\.?\s*(\d+)/i);
  if (ch) return `ch${ch[1]}${k.includes("mean") ? "-mean" : k.includes("nice") ? "-nice" : ""}`;
  const num = k.match(/^(\d+)/);
  if (num) return num[1];
  return k.toLowerCase();
}

function parseCountTable(text, headingPattern) {
  const { rows } = parseTableSection(text, headingPattern);
  const data = new Map();
  for (const row of rows) {
    if (!row[0] || /^total/i.test(row[0])) continue;
    const display = row[0].replace(/\*\*/g, "").trim();
    const key = normalizeKey(row[0]);
    const raw = (row[1] || "0").replace(/\*\*/g, "").trim();
    const numMatch = raw.match(/^(\d+\+?)/);
    const count = numMatch ? numMatch[1] : raw.startsWith("0") ? "0" : raw;
    const prev = data.get(key);
    if (!prev || display.length > prev.display.length) {
      data.set(key, { display, count });
    } else {
      data.set(key, { ...prev, count });
    }
  }
  return data;
}

function extractNotes(text) {
  const parts = [];
  for (const re of [/## Female orgasm review[\s\S]*/i, /## Known narration bugs[\s\S]*/i]) {
    const m = text.match(re);
    if (m) parts.push(m[0].trim());
  }

  const afterMale = text.match(
    /## Male character status[\s\S]*?\n\n([\s\S]*?)\n---\n\n## Balls popped/i,
  );
  if (afterMale?.[1]?.trim()) {
    parts.unshift("## Additional notes\n\n" + afterMale[1].trim());
  }

  const headerNotes = text.match(/^#[^\n]+\n\n([\s\S]*?)---\n\n## Male/i);
  if (headerNotes?.[1]?.trim() && !headerNotes[1].trim().startsWith("##")) {
    parts.unshift("## Scope\n\n" + headerNotes[1].trim());
  }

  for (const [heading, re] of [
    ["Footnotes", /## Female orgasms[\s\S]*?\n\n(\*\*[^*][\s\S]*?)(?=\n---|\n## |$)/i],
    ["Pop count notes", /## Balls popped[\s\S]*?\n\n(\*\*[^*][\s\S]*?)(?=\n---|\n## |$)/i],
  ]) {
    const m = text.match(re);
    if (m?.[1]?.trim()) parts.push(`## ${heading}\n\n${m[1].trim()}`);
  }

  return parts.filter(Boolean).join("\n\n---\n\n");
}

function normalizeMaleRows(rows, slug) {
  if (slug !== "three-strikes") {
    return rows.filter((r) => !/middle nut|third gonad/i.test(r[0] || ""));
  }

  const out = [];
  let samMiddle = null;
  for (const row of rows) {
    if (/Sam's middle nut|middle nut \(triorchidism\)/i.test(row[0] || "")) {
      samMiddle = (row[2] || row[1] || "").replace(/^n\/a[^—]*—?\s*/i, "");
      continue;
    }
    if (/Sam Johnson/i.test(row[0] || "")) {
      const left = (row[1] || "").trim();
      const right = (row[2] || "")
        .replace(/\s*;\s*middle triorchid was his third.*$/i, "")
        .replace(/\s*\(also \*\*popped\*\* at Taylor's.*$/i, "")
        .trim();
      out.push([row[0], left, right, samMiddle || "—"]);
      continue;
    }
    out.push([row[0], row[1] || "", row[2] || "", "—"]);
  }
  return out;
}

function unitLabel(meta, slug) {
  if (slug === "andrea-lucas" || meta.throughChapter) return "Chapter";
  return "Section";
}

function sortKeys(keys) {
  return keys.sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

function mergeCountTables(pops, orgasms, meta, slug) {
  const sectionCount = meta.sectionCount || 1;
  const label = unitLabel(meta, slug);
  const popTotal = String(meta.totalPops ?? 0);
  const orgTotal = String(meta.totalFemaleOrgasms ?? 0);

  if (sectionCount <= 1) {
    return {
      header: ["", "Testicles popped", "Female orgasms"],
      rows: [[`**Total**`, popTotal, orgTotal]],
      multi: false,
    };
  }

  const keys = sortKeys([...new Set([...pops.keys(), ...orgasms.keys()])]);
  const rows = keys.map((key) => {
    const display = pops.get(key)?.display || orgasms.get(key)?.display || key;
    return [
      `**${display}**`,
      pops.get(key)?.count ?? "0",
      orgasms.get(key)?.count ?? "0",
    ];
  });
  rows.push([`**Total**`, popTotal, orgTotal]);

  return {
    header: [label, "Testicles popped", "Female orgasms"],
    rows,
    multi: true,
  };
}

function renderTable(header, rows) {
  return [
    "| " + header.join(" | ") + " |",
    "| " + header.map(() => "---").join(" | ") + " |",
    ...rows.map((r) => "| " + r.join(" | ") + " |"),
  ].join("\n");
}

function normalizeFile(slug) {
  const slugDir = path.join(STATS_DIR, slug);
  const reportFile = findReportFile(slugDir);
  if (!reportFile) return null;

  const meta = JSON.parse(fs.readFileSync(path.join(slugDir, "meta.json"), "utf8"));
  const text = fs.readFileSync(path.join(slugDir, reportFile), "utf8");
  const title = text.match(/^# (.+)/)?.[1] || meta.title;

  const male = parseTableSection(text, "Male character status[^\\n]*");
  const maleRows = normalizeMaleRows(male.rows, slug);
  const maleHeader =
    slug === "three-strikes"
      ? ["Male character", "Left testicle", "Right testicle", "Middle testicle"]
      : ["Male character", "Left testicle", "Right testicle"];

  const pops = parseCountTable(text, "Balls popped per (?:section|chapter)[^\\n]*");
  const orgasms = parseCountTable(
    text,
    "Female orgasms per (?:section|chapter)[^\\n]*",
  );

  const counts = mergeCountTables(pops, orgasms, meta, slug);
  const notes = extractNotes(text);
  const unit = unitLabel(meta, slug).toLowerCase();

  const out = [
    `# ${title}`,
    "",
    "## Male testicle status",
    "",
    renderTable(maleHeader, maleRows),
    "",
    "## Pops and female orgasms",
    "",
    renderTable(counts.header, counts.rows),
    "",
    counts.multi
      ? `_Per-${unit} counts; see [notes.md](./notes.md) for methodology and commentary._`
      : `_Story totals only; see [notes.md](./notes.md) for methodology and commentary._`,
    "",
  ].join("\n");

  fs.writeFileSync(path.join(slugDir, reportFile), out);

  const notesPath = path.join(slugDir, "notes.md");
  if (notes.trim()) {
    fs.writeFileSync(notesPath, `# ${title} — notes\n\n${notes}\n`);
  } else if (fs.existsSync(notesPath)) {
    fs.unlinkSync(notesPath);
  }

  return slug;
}

const slugs = fs
  .readdirSync(STATS_DIR)
  .filter((d) => fs.existsSync(path.join(STATS_DIR, d, "meta.json")));

console.log(`Normalized ${slugs.map(normalizeFile).filter(Boolean).length} reports.`);
