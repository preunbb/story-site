/**
 * One-shot: split connections.js prose into data/infopanel.js and slim edges.
 * Run: node scripts/migrate-infopanel.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadWindowScript(rel) {
  const code = fs.readFileSync(path.join(root, rel), "utf8");
  const sandbox = { window: {}, console };
  vm.runInNewContext(code, sandbox);
  return sandbox.window;
}

const wChars = loadWindowScript("data/characters.js");
const wStories = loadWindowScript("data/stories.js");
const wConn = loadWindowScript("data/connections.js");

const characters = wChars.DATA_CHARACTERS || [];
const stories = wStories.DATA_STORIES || [];
const connections = wConn.DATA_CONNECTIONS || [];

const charById = Object.create(null);
characters.forEach((c) => {
  if (c && c.id) charById[c.id] = c;
});
const storyById = Object.create(null);
stories.forEach((s) => {
  if (s && s.id != null) storyById[Number(s.id)] = s;
});

function getCharacterById(id) {
  return charById[id] || null;
}
function getStoryById(id) {
  if (id == null || id === "") return null;
  return storyById[Number(id)] || null;
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function connectionLabelForViewer(edge, viewerId) {
  if (!edge) return "Connection";
  if (viewerId && edge.to === viewerId && edge.reverseLabel) {
    return edge.reverseLabel;
  }
  return edge.label || edge.reverseLabel || "Connection";
}

function connectionLinksForViewer(edge, viewerId) {
  if (!edge) return [];
  if (viewerId && edge.to === viewerId && edge.reverseLabel) {
    return edge.reverseLabelLinks || edge.links || [];
  }
  return edge.labelLinks || edge.links || [];
}

function connectionOtherId(edge, viewerId) {
  if (!edge) return null;
  return edge.from === viewerId ? edge.to : edge.from;
}

function connectionDetailChronoRank(edge) {
  if (!edge) return 1000;
  if (typeof edge.chrono === "number") return edge.chrono;
  const kinds = edge.kinds || [];
  const hasLeft = kinds.indexOf("left") !== -1;
  const hasRight = kinds.indexOf("right") !== -1;
  if (hasLeft && !hasRight) return 10;
  if (hasRight && !hasLeft) return 20;
  if (hasLeft && hasRight) return 30;
  return 100;
}

function connectionSentencePhrase(rawLabel) {
  const label = String(rawLabel || "").trim();
  if (!label) return "Connected";
  let m;
  if ((m = /^Mother of (.+)$/i.exec(label))) return m[1] + "'s mother";
  if ((m = /^Son of (.+)$/i.exec(label))) return m[1] + "'s son";
  if ((m = /^Daughter of (.+)$/i.exec(label))) return m[1] + "'s daughter";
  if ((m = /^Sister of (.+)$/i.exec(label))) return m[1] + "'s sister";
  if ((m = /^Brother of (.+)$/i.exec(label))) return m[1] + "'s brother";
  if ((m = /^Stepmom (.+)$/i.exec(label))) return "Stepmother who " + m[1];
  if ((m = /^Stepsister (\w+) (.+)$/i.exec(label)))
    return "Stepsister who " + m[2];
  return label;
}

function connectionAutoMatchTextsForCharacter(characterId) {
  const c = getCharacterById(characterId);
  if (!c || !c.name) return [];
  const name = String(c.name).trim();
  const texts = [name];
  const titleRe = /^(Goddess|Ms\.|Mrs\.|Mr\.|Dr\.|The)\s+/i;
  const stopFirst = /^(Goddess|Ms\.|Mrs\.|Mr\.|Dr\.|The|A|An)$/i;
  const withoutTitle = name.replace(titleRe, "");
  const parts = name.split(/\s+/).filter(Boolean);
  if (
    parts.length > 1 &&
    parts[0].length >= 3 &&
    !stopFirst.test(parts[0]) &&
    !/^Church$/i.test(parts[0])
  ) {
    texts.push(parts[0]);
  }
  if (
    withoutTitle &&
    withoutTitle !== name &&
    withoutTitle.length >= 2 &&
    !stopFirst.test(withoutTitle)
  ) {
    texts.push(withoutTitle);
  }
  if (Array.isArray(c.connectionMatchAliases)) {
    c.connectionMatchAliases.forEach((alias) => {
      const a = String(alias || "").trim();
      if (a && texts.indexOf(a) === -1) texts.push(a);
    });
  }
  return texts;
}

function connectionLinkMatchTexts(link) {
  if (!link) return [];
  if (link.match) return [String(link.match)];
  if (link.storyId != null) {
    const story = getStoryById(link.storyId);
    return story && story.title ? [story.title] : [];
  }
  if (link.id) return connectionAutoMatchTextsForCharacter(link.id);
  return [];
}

function connectionMatchRegExp(matchText) {
  return new RegExp("\\b" + escapeRegExp(String(matchText || "")) + "\\b", "gi");
}

/** Convert a phrase + link specs into text with [[char:]] / [[story:]] tags. */
function linkifyToTemplate(phrase, links, otherIds, preferStoryId) {
  const candidates = [];
  const others = Array.isArray(otherIds)
    ? otherIds.filter(Boolean)
    : otherIds
      ? [otherIds]
      : [];

  function add(target, matchTexts, kind) {
    (matchTexts || []).forEach((mt) => {
      if (!mt) return;
      const re = connectionMatchRegExp(mt);
      let m;
      while ((m = re.exec(phrase))) {
        candidates.push({
          start: m.index,
          end: m.index + m[0].length,
          text: m[0],
          kind,
          id: target.id,
          storyId: target.storyId,
        });
      }
    });
  }

  (links || []).forEach((link) => {
    if (!link) return;
    if (link.storyId != null) {
      add({ storyId: link.storyId }, connectionLinkMatchTexts(link), "story");
    } else if (link.id) {
      add({ id: link.id }, connectionLinkMatchTexts(link), "char");
    }
  });

  // Prefer this entry's story title (and common "Part N" shortenings) so
  // "Melody's First Time" doesn't become [[char:melody]]'s First Time.
  if (preferStoryId != null) {
    const story = getStoryById(preferStoryId);
    if (story && story.title) {
      const texts = [story.title];
      const m = /^(.*?):\s*(Part\s+\d+)\s*$/i.exec(story.title);
      if (m) texts.push(m[1].trim() + " " + m[2]);
      add({ storyId: preferStoryId }, texts, "story");
    }
  }

  others.forEach((oid) => {
    add({ id: oid }, connectionAutoMatchTextsForCharacter(oid), "char");
  });

  // Auto-link other cast names appearing in the phrase.
  const seen = Object.create(null);
  others.forEach((oid) => {
    seen[oid] = true;
  });
  (links || []).forEach((link) => {
    if (link && link.id) seen[link.id] = true;
  });
  characters.forEach((c) => {
    if (!c || !c.id || seen[c.id]) return;
    add({ id: c.id }, connectionAutoMatchTextsForCharacter(c.id), "char");
  });

  candidates.sort((a, b) => {
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA;
    return a.start - b.start;
  });

  const chosen = [];
  candidates.forEach((c) => {
    const overlaps = chosen.some(
      (x) => !(c.end <= x.start || c.start >= x.end),
    );
    if (!overlaps) chosen.push(c);
  });
  chosen.sort((a, b) => a.start - b.start);

  const matchedIds = Object.create(null);
  chosen.forEach((c) => {
    if (c.kind === "char" && c.id) matchedIds[c.id] = true;
  });

  let out = "";
  let last = 0;
  chosen.forEach((c) => {
    out += phrase.slice(last, c.start);
    if (c.kind === "story") {
      const story = getStoryById(c.storyId);
      const defaultTitle = story ? story.title : String(c.storyId);
      if (c.text === defaultTitle) {
        out += `[[story:${c.storyId}]]`;
      } else {
        out += `[[story:${c.storyId}|${c.text}]]`;
      }
    } else {
      const ch = getCharacterById(c.id);
      const defaultName = ch ? ch.name : c.id;
      if (c.text === defaultName) {
        out += `[[char:${c.id}]]`;
      } else {
        out += `[[char:${c.id}|${c.text}]]`;
      }
    }
    last = c.end;
  });
  out += phrase.slice(last);

  // Parenthetical for unmatched others (legacy behavior).
  const unmatched = others.filter((id) => id && !matchedIds[id]);
  if (unmatched.length) {
    const names = unmatched.map((id) => {
      const ch = getCharacterById(id);
      const name = ch ? ch.name : id;
      return name === (ch && ch.name) ? `[[char:${id}]]` : `[[char:${id}|${name}]]`;
    });
    let list;
    if (names.length === 1) list = names[0];
    else if (names.length === 2) list = names[0] + " and " + names[1];
    else
      list = names.slice(0, -1).join(", ") + ", and " + names[names.length - 1];
    if (/\.\s*$/.test(out)) {
      out = out.replace(/\.\s*$/, " (" + list + ").");
    } else {
      out += " (" + list + ")";
    }
  }

  return out;
}

function formatNameList(ids) {
  const names = ids.map((id) => {
    const ch = getCharacterById(id);
    return ch ? ch.name : id;
  });
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return names[0] + " and " + names[1];
  return names.slice(0, -1).join(", ") + ", and " + names[names.length - 1];
}

function expandOthersTokens(phrase, otherIds) {
  let p = phrase;
  if (otherIds.length < 2 && /\{others\}/i.test(p)) {
    p = p
      .replace(/\{others\} all help/gi, "{other} helps")
      .replace(/\{others\}/gi, "{other}");
  }
  const nameList = formatNameList(otherIds);
  return p.replace(/\{others\}|\{other\}/gi, nameList);
}

function isFaction(id) {
  const ch = getCharacterById(id);
  return !!(ch && ch.entityType === "faction");
}

/** Build one display sentence template for a collated detail group. */
function buildSentenceTemplate(edge, viewerId, otherIds) {
  const others =
    otherIds && otherIds.length
      ? otherIds.slice()
      : [connectionOtherId(edge, viewerId)].filter(Boolean);
  const primaryOtherId = others[0] || null;
  const other = primaryOtherId ? getCharacterById(primaryOtherId) : null;
  const story = getStoryById(edge.storyId);
  const storyTitle = story ? story.title || "a story" : "a story";
  const rawLabel = connectionLabelForViewer(edge, viewerId);
  let phrase = connectionSentencePhrase(
    rawLabel,
    other ? other.name : primaryOtherId,
  );
  phrase = expandOthersTokens(phrase, others);

  const links = connectionLinksForViewer(edge, viewerId);
  let templated = linkifyToTemplate(phrase, links, others, edge.storyId);

  const otherIsFaction = others.some(isFaction);

  if (otherIsFaction) {
    if (!/\.\s*$/.test(templated)) templated += ".";
    return templated;
  }

  // Authored complete sentences — keep as-is (story name already linked if present).
  if (/\.\s*$/.test(phrase)) {
    if (!/\.\s*$/.test(templated)) templated += ".";
    return templated;
  }

  // If the story title (or a short form) is already linked in the text, don't suffix.
  if (/\[\[story:/.test(templated)) {
    if (!/\.\s*$/.test(templated)) templated += ".";
    return templated;
  }

  const storyTag = `[[story:${edge.storyId}]]`;

  if (/\bin\b/i.test(phrase.replace(/\{others\}|\{other\}/gi, "x"))) {
    return templated + ", from " + storyTag + ".";
  }
  return templated + " in " + storyTag + ".";
}

/** When combining sentences, keep a single trailing story link on the last
 *  sentence that originally had a story suffix (so faction lines stay clean). */
function combineStorySentences(sentences, storyId) {
  if (!sentences || !sentences.length) return "";
  if (sentences.length === 1) return sentences[0];

  const suffixRe =
    /(?:, from | in )\[\[story:(\d+)(?:\|[^\]]+)?\]\]\.\s*$/;
  let lastHad = -1;
  const stripped = sentences.map((s, i) => {
    const m = suffixRe.exec(s);
    if (m && Number(m[1]) === Number(storyId)) {
      lastHad = i;
      return s.replace(suffixRe, "").trim();
    }
    return s.trim();
  });

  const parts = stripped.map((s, i) => {
    if (i === lastHad) {
      const base = /\.\s*$/.test(s) ? s.replace(/\.\s*$/, "") : s;
      return base + " in [[story:" + storyId + "]].";
    }
    return /\.\s*$/.test(s) ? s : s + ".";
  });

  return parts.join(" ");
}

function compareStoriesForCharacterDisplay(a, b) {
  const aSeries = a && a.series && a.series.id;
  const bSeries = b && b.series && b.series.id;
  const aOrd =
    a && a.series && typeof a.series.order === "number" ? a.series.order : null;
  const bOrd =
    b && b.series && typeof b.series.order === "number" ? b.series.order : null;
  if (aSeries && aSeries === bSeries && aOrd != null && bOrd != null) {
    return aOrd - bOrd;
  }
  if (aSeries === "ballbusting-arena" && bSeries !== "ballbusting-arena") {
    return -1;
  }
  if (bSeries === "ballbusting-arena" && aSeries !== "ballbusting-arena") {
    return 1;
  }
  return stories.indexOf(a) - stories.indexOf(b);
}

function getStoriesForCharacter(charId) {
  const list = stories.filter(
    (s) => s && Array.isArray(s.characterIds) && s.characterIds.indexOf(charId) !== -1,
  );
  list.sort(compareStoriesForCharacterDisplay);
  return list;
}

function storyOrderIndexForCharacter(storyId, charId) {
  const list = getStoriesForCharacter(charId);
  const want = storyId != null ? Number(storyId) : NaN;
  for (let i = 0; i < list.length; i++) {
    if (Number(list[i].id) === want) return i;
  }
  if (storyId == null || storyId === "") return 10000;
  return 1000 + (Number(storyId) || 0);
}

function edgesForCharacter(charId) {
  return connections.filter((e) => {
    if (!e || (e.from !== charId && e.to !== charId)) return false;
    const omit = e.omitDetailFor;
    if (omit && omit.length && omit.indexOf(charId) !== -1) return false;
    return true;
  });
}

function collate(edges, viewerId) {
  const groups = [];
  const indexByKey = Object.create(null);
  edges.forEach((edge) => {
    const label = connectionLabelForViewer(edge, viewerId) || "";
    const key = String(edge.storyId != null ? edge.storyId : "") + "\0" + label;
    let idx = indexByKey[key];
    if (idx == null) {
      indexByKey[key] = groups.length;
      groups.push({
        edge,
        otherIds: [],
        _seen: Object.create(null),
        chrono: connectionDetailChronoRank(edge),
      });
      idx = groups.length - 1;
    } else {
      groups[idx].chrono = Math.min(
        groups[idx].chrono,
        connectionDetailChronoRank(edge),
      );
    }
    const oid = connectionOtherId(edge, viewerId);
    if (oid && !groups[idx]._seen[oid]) {
      groups[idx]._seen[oid] = true;
      groups[idx].otherIds.push(oid);
    }
  });
  return groups;
}

/** Build infopanel map: characterId -> [{ storyId, text }] */
const infopanel = Object.create(null);

characters.forEach((c) => {
  if (!c || !c.id) return;
  const charId = c.id;
  const edges = edgesForCharacter(charId);
  if (!edges.length) return;
  const groups = collate(edges, charId);

  // Build sentence per collated group, then merge by storyId.
  const byStory = Object.create(null);
  groups.forEach((g) => {
    const sid = g.edge.storyId;
    const text = buildSentenceTemplate(g.edge, charId, g.otherIds);
    if (!byStory[sid]) {
      byStory[sid] = { storyId: sid, sentences: [], chrono: g.chrono };
    }
    // Dedupe identical sentences (collation already unique by label, but be safe).
    if (byStory[sid].sentences.indexOf(text) === -1) {
      byStory[sid].sentences.push(text);
    }
    byStory[sid].chrono = Math.min(byStory[sid].chrono, g.chrono);
  });

  const storyIds = Object.keys(byStory).sort((a, b) => {
    const ia = storyOrderIndexForCharacter(a, charId);
    const ib = storyOrderIndexForCharacter(b, charId);
    if (ia !== ib) return ia - ib;
    return byStory[a].chrono - byStory[b].chrono;
  });

  // Within each story, sentences were pushed in collation order (edge array order).
  // Re-sort sentences by the chrono of their source group — already roughly ok if we
  // sort groups first.
  const sortedGroups = groups.slice().sort((a, b) => {
    const ia = storyOrderIndexForCharacter(a.edge.storyId, charId);
    const ib = storyOrderIndexForCharacter(b.edge.storyId, charId);
    if (ia !== ib) return ia - ib;
    return a.chrono - b.chrono;
  });

  const rebuilt = Object.create(null);
  sortedGroups.forEach((g) => {
    const sid = g.edge.storyId;
    const text = buildSentenceTemplate(g.edge, charId, g.otherIds);
    if (!rebuilt[sid]) rebuilt[sid] = [];
    if (rebuilt[sid].indexOf(text) === -1) rebuilt[sid].push(text);
  });

  const entries = storyIds.map((sid) => {
    const sentences = rebuilt[sid] || byStory[sid].sentences;
    return {
      storyId: Number(sid) || sid,
      text: combineStorySentences(sentences, sid),
    };
  });

  if (entries.length) infopanel[charId] = entries;
});

// --- Write slim connections ---
function slimEdge(e) {
  const out = {
    from: e.from,
    to: e.to,
    storyId: e.storyId,
    kinds: e.kinds.slice(),
  };
  if (e.hubPrefer) out.hubPrefer = true;
  return out;
}

const slimConnections = connections.map(slimEdge);

function serializeJsValue(value, indent) {
  const pad = "  ".repeat(indent);
  const padIn = "  ".repeat(indent + 1);
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    // Compact kinds arrays etc.
    const allPrimitive = value.every(
      (v) =>
        v == null ||
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean",
    );
    if (allPrimitive && value.length <= 8) {
      return (
        "[" +
        value.map((v) => serializeJsValue(v, indent + 1)).join(", ") +
        "]"
      );
    }
    return (
      "[\n" +
      value
        .map((v) => padIn + serializeJsValue(v, indent + 1))
        .join(",\n") +
      "\n" +
      pad +
      "]"
    );
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) return "{}";
    return (
      "{\n" +
      keys
        .map(
          (k) =>
            padIn +
            (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : JSON.stringify(k)) +
            ": " +
            serializeJsValue(value[k], indent + 1),
        )
        .join(",\n") +
      "\n" +
      pad +
      "}"
    );
  }
  return JSON.stringify(value);
}

const connectionsHeader = `// Character relationship graph for the Connections tab.
// Each edge: { from, to, storyId, kinds, hubPrefer? }
// kinds is required: family | relationship | knows | faction | left | right | dick | pain
// Rule: pain never coexists with left/right for the same character pair (any edge).
// hubPrefer (optional): prefer parking the other endpoint on this hub's wheel.
// Info-panel prose lives in data/infopanel.js — not here.
window.DATA_CONNECTIONS = `;

const infopanelHeader = `// Connections tab info-panel copy, keyed by character id.
// Each entry: { storyId, text } — ordered list shown when that character is selected.
// Multiple former edges for the same story are merged into one text block of sentences.
//
// Inline link markup (parsed at render time):
//   [[char:id]]           — link using the character's catalog name
//   [[char:id|display]]   — link with custom visible text
//   [[story:id]]          — link using the story title
//   [[story:id|display]]  — link with custom visible text
//
window.DATA_INFOPANEL = `;

fs.writeFileSync(
  path.join(root, "data/connections.js"),
  connectionsHeader + serializeJsValue(slimConnections, 0) + ";\n",
);

// Stable key order: characters order
const orderedPanel = {};
characters.forEach((c) => {
  if (c && c.id && infopanel[c.id]) orderedPanel[c.id] = infopanel[c.id];
});

fs.writeFileSync(
  path.join(root, "data/infopanel.js"),
  infopanelHeader + serializeJsValue(orderedPanel, 0) + ";\n",
);

const charCount = Object.keys(orderedPanel).length;
const lineCount = Object.values(orderedPanel).reduce((n, a) => n + a.length, 0);
console.log(
  "Wrote data/connections.js (" +
    slimConnections.length +
    " edges) and data/infopanel.js (" +
    charCount +
    " characters, " +
    lineCount +
    " story blocks).",
);

// Spot-check a few
for (const id of ["melody", "stuart", "dan", "sam", "abby"]) {
  console.log("\n===", id, "===");
  (orderedPanel[id] || []).forEach((e) => {
    console.log("[" + e.storyId + "]", e.text);
  });
}
