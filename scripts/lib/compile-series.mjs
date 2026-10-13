/**
 * Build a single reader markdown file from every released story in a catalog
 * series. A story opts in with `compileFromSeries: "<series id>"` and no
 * driveUrl. `npm run sync` rewrites assets/stories/<id>.md from the current
 * series members (sorted by series.order), so a newly added day is picked up
 * on the next sync without editing the collection entry's chapter list.
 *
 * Each member becomes one `##` chapter. Its cover is inserted as a
 * `[[scene:<filename>]]` tag, which the reader resolves after
 * expandCompiledSeriesStories() copies member covers and scenes onto the
 * collection.
 */

import { readFileSync, writeFileSync } from "node:fs";

export function seriesOrder(story) {
  return story &&
    story.series &&
    typeof story.series.order === "number" &&
    Number.isFinite(story.series.order)
    ? story.series.order
    : Number.POSITIVE_INFINITY;
}

function isComingSoon(story) {
  const st = story && story.state;
  return st === 1 || st === "1";
}

/** Released / in-progress members of a series, excluding collections themselves. */
export function compiledSeriesMembers(stories, seriesId) {
  if (!seriesId || !Array.isArray(stories)) return [];
  return stories
    .filter((s) => {
      if (!s || s.compileFromSeries) return false;
      if (!s.series || s.series.id !== seriesId) return false;
      if (isComingSoon(s)) return false;
      return true;
    })
    .sort((a, b) => {
      const d = seriesOrder(a) - seriesOrder(b);
      if (d) return d;
      return String(a.id).localeCompare(String(b.id), undefined, {
        numeric: true,
      });
    });
}

/** Filename without extension. Unique enough to be a [[scene:]] substring. */
export function coverSceneIdentifier(coverPath) {
  const base = String(coverPath || "").split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

/** Source `#` / `##` headings become `###` so only collection chapters are h2. */
export function demoteSourceHeadings(md) {
  return String(md || "").replace(/^#{1,2}(?=\s)/gm, "###");
}

function pushScene(scenes, seen, scene) {
  if (!scene || !scene.path || seen.has(scene.path)) return;
  seen.add(scene.path);
  scenes.push(scene);
}

/**
 * Copy each member's cover and scenes onto a collection story so
 * `[[scene:]]` tags in the compiled markdown resolve. Also unions
 * characterIds in series order. Mutates the collection stories in place.
 */
export function expandCompiledSeriesStories(stories) {
  if (!Array.isArray(stories)) return stories;
  for (const story of stories) {
    if (!story || !story.compileFromSeries) continue;
    const members = compiledSeriesMembers(stories, story.compileFromSeries);
    const scenes = [];
    const seenPaths = new Set();
    const characterIds = [];
    const seenChars = new Set();
    for (const member of members) {
      const coverListed = (member.scenes || []).some(
        (sc) => sc && sc.path === member.cover,
      );
      if (member.cover && !coverListed) {
        pushScene(scenes, seenPaths, {
          path: member.cover,
          caption: member.title || "Cover",
        });
      }
      for (const sc of member.scenes || []) pushScene(scenes, seenPaths, sc);
      for (const id of member.characterIds || []) {
        if (id == null || seenChars.has(id)) continue;
        seenChars.add(id);
        characterIds.push(id);
      }
    }
    story.scenes = scenes;
    story.characterIds = characterIds;
  }
  return stories;
}

export function buildCompiledSeriesMarkdown(members, readMemberMd) {
  const parts = [];
  for (const member of members) {
    const title = String(member.title || `Story ${member.id}`).trim();
    const chunks = [`## ${title}`, ""];
    if (member.cover) {
      const ident = coverSceneIdentifier(member.cover);
      if (!ident) {
        throw new Error(
          `Story #${member.id} cover has no filename: ${member.cover}`,
        );
      }
      chunks.push(`[[scene:${ident}]]`, "");
    }
    const raw = readMemberMd(member);
    const body = demoteSourceHeadings(raw).trim();
    if (body) chunks.push(body);
    parts.push(chunks.join("\n").trim());
  }
  return parts.join("\n\n") + (parts.length ? "\n" : "");
}

/**
 * The [[scene:]] identifier must hit this member's cover, not an earlier
 * scene whose path happens to contain the same substring.
 */
export function assertCoverIdentifiers(members) {
  const scenes = [];
  const seen = new Set();
  for (const member of members) {
    if (!member.cover) continue;
    const ident = coverSceneIdentifier(member.cover);
    const coverListed = (member.scenes || []).some(
      (sc) => sc && sc.path === member.cover,
    );
    if (!coverListed) {
      pushScene(scenes, seen, { path: member.cover, caption: member.title });
    }
    for (const sc of member.scenes || []) pushScene(scenes, seen, sc);
    const hit = scenes.find(
      (sc) => sc.path === ident || sc.path.indexOf(ident) !== -1,
    );
    if (!hit || hit.path !== member.cover) {
      throw new Error(
        `Cover scene id "${ident}" for #${member.id} does not resolve to ${member.cover}` +
          (hit ? ` (matched ${hit.path} first)` : ""),
      );
    }
  }
}

const ID_RE = /^    id:\s+(\d+),\s*$/;
const COVER_RE = /^    cover:\s+"[^"]*",?\s*$/;
const RELEASE_RE = /^    releaseDate:\s+"[^"]*",?\s*$/;

function storyBlocks(lines) {
  const blocks = [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (start === -1) {
      if (line === "  {") start = i;
    } else if (line === "  }," || line === "  }") {
      blocks.push({ start, end: i });
      start = -1;
    }
  }
  return blocks;
}

function findStoryBlock(lines, id) {
  for (const blk of storyBlocks(lines)) {
    for (let i = blk.start; i <= blk.end; i++) {
      const m = lines[i].match(ID_RE);
      if (m && Number(m[1]) === id) return blk;
    }
  }
  return null;
}

/**
 * Point a collection's catalog card at the latest chapter: cover image and
 * release date follow the last series member. Word count is handled by
 * applyWordCountUpdates.
 */
export function applyCompilationCatalogFields(filepath, updates) {
  if (!updates.length) return [];
  const content = readFileSync(filepath, "utf8");
  const lines = content.split("\n");
  const results = [];
  let dirty = false;

  for (const update of updates) {
    const blk = findStoryBlock(lines, update.id);
    if (!blk) {
      results.push({ id: update.id, status: "block-not-found" });
      continue;
    }
    const changed = [];
    if (update.cover) {
      const next = `    cover: "${update.cover}",`;
      let idx = -1;
      for (let i = blk.start; i <= blk.end; i++) {
        if (COVER_RE.test(lines[i])) {
          idx = i;
          break;
        }
      }
      if (idx === -1) {
        results.push({ id: update.id, status: "cover-line-not-found" });
      } else if (lines[idx] !== next) {
        lines[idx] = next;
        dirty = true;
        changed.push("cover");
      }
    }
    if (update.releaseDate) {
      const next = `    releaseDate: "${update.releaseDate}",`;
      let idx = -1;
      for (let i = blk.start; i <= blk.end; i++) {
        if (RELEASE_RE.test(lines[i])) {
          idx = i;
          break;
        }
      }
      if (idx === -1) {
        results.push({ id: update.id, status: "release-line-not-found" });
      } else if (lines[idx] !== next) {
        lines[idx] = next;
        dirty = true;
        changed.push("releaseDate");
      }
    }
    results.push({
      id: update.id,
      status: changed.length ? "updated" : "unchanged",
      changed,
    });
  }

  if (dirty) writeFileSync(filepath, lines.join("\n"), "utf8");
  return results;
}
