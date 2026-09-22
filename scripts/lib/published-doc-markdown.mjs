/**
 * Convert a published Google Doc HTML page (same shape as sync-stories uses)
 * into Markdown. Shared by scripts/sync-stories.mjs and tools/copy-edit-server.
 */

import * as cheerio from "cheerio";
import TurndownService from "turndown";

export function makeTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    hr: "---",
    codeBlockStyle: "fenced",
    linkStyle: "inlined",
  });
  td.addRule("dropImages", { filter: "img", replacement: () => "" });
  td.addRule("docInlineSpan", {
    filter(node) {
      return (
        node.nodeName === "SPAN" &&
        /\bdoc-(?:font|size|color)-/.test(node.getAttribute("class") || "")
      );
    },
    replacement(content, node) {
      // Scene tags must stay bare paragraphs for the reader regex; never wrap them.
      if (/^\s*\[\[\s*scene\s*:[^\]]+\]\]\s*$/i.test(content)) {
        return content.trim();
      }
      const cls = (node.getAttribute("class") || "")
        .split(/\s+/)
        .filter(
          (c) =>
            c.startsWith("doc-font-") ||
            c.startsWith("doc-size-") ||
            c.startsWith("doc-color-"),
        )
        .join(" ");
      return `<span class="${cls}">${content}</span>`;
    },
  });
  td.addRule("underlineTag", {
    filter: ["u"],
    replacement(content) {
      return `<u>${content}</u>`;
    },
  });
  td.escape = (s) => s;
  return td;
}

function normalizeFontFamily(value) {
  if (!value) return null;
  const v = value.toLowerCase().replace(/["']/g, "").trim();
  if (/courier|consolas|monaco|monospace/.test(v)) return "mono";
  if (/comic/.test(v)) return "comic";
  if (/times|georgia|garamond|palatino|serif/.test(v) && !/sans/.test(v)) {
    return "serif";
  }
  if (/arial|roboto|google sans|helvetica|sans/.test(v)) return "sans";
  return null;
}

function fontFamilyToDocClass(fontFamily) {
  const kind = normalizeFontFamily(fontFamily);
  if (!kind || kind === "sans") return null;
  return `doc-font-${kind}`;
}

function fontSizeToDocClass(fontSize) {
  if (!fontSize) return null;
  const m = String(fontSize)
    .trim()
    .match(/^([\d.]+)\s*(pt|px|em|%)$/i);
  if (!m) return null;
  const num = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "pt" && Math.abs(num - 11) < 0.05) return null;
  const label = unit === "pt" ? `${Math.round(num)}pt` : `${num}${unit}`;
  return `doc-size-${label}`;
}

function emptyFormattingFlags() {
  return {
    italic: false,
    bold: false,
    underline: false,
    fontFamily: null,
    fontSize: null,
    color: null,
  };
}

/** Normalize CSS color to lowercase hex without '#', or null if unparseable / default ink. */
function cssColorToDocHex(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  let hex = null;
  const hexM = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexM) {
    let h = hexM[1];
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (h.length === 8) h = h.slice(0, 6);
    hex = h.toLowerCase();
  } else {
    const rgbM = v.match(
      /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/,
    );
    if (rgbM) {
      hex = [rgbM[1], rgbM[2], rgbM[3]]
        .map((n) => {
          const x = Math.max(0, Math.min(255, parseInt(n, 10)));
          return x.toString(16).padStart(2, "0");
        })
        .join("");
    }
  }
  if (!hex) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Skip near-black / default Docs body ink so we don't wrap every run.
  if (r <= 0x40 && g <= 0x40 && b <= 0x40) return null;
  return hex;
}

function colorToDocClass(color) {
  const hex = cssColorToDocHex(color);
  return hex ? `doc-color-${hex}` : null;
}

function propsToFormattingFlags(props) {
  const flags = emptyFormattingFlags();
  const fontStyle = props["font-style"];
  if (fontStyle && /italic/i.test(fontStyle)) flags.italic = true;
  const fontWeight = props["font-weight"];
  if (
    fontWeight &&
    /(?:bold|bolder|[6-9]00\b)/i.test(fontWeight)
  ) {
    flags.bold = true;
  }
  const textDecoration = props["text-decoration"];
  if (textDecoration && /underline/i.test(textDecoration)) {
    flags.underline = true;
  }
  if (props["font-family"]) flags.fontFamily = props["font-family"];
  if (props["font-size"]) flags.fontSize = props["font-size"];
  if (props.color) flags.color = props.color;
  return flags;
}

function parseStyleClassFormatting($) {
  const propMaps = new Map();
  const ruleRe = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
  $("style").each((_, el) => {
    const css = $(el).contents().text();
    let m;
    while ((m = ruleRe.exec(css))) {
      const name = m[1];
      const decl = m[2];
      if (!propMaps.has(name)) propMaps.set(name, {});
      const props = propMaps.get(name);
      for (const part of decl.split(";")) {
        const idx = part.indexOf(":");
        if (idx === -1) continue;
        const key = part.slice(0, idx).trim().toLowerCase();
        const val = part.slice(idx + 1).trim();
        if (key) props[key] = val;
      }
    }
    ruleRe.lastIndex = 0;
  });
  const map = new Map();
  for (const [name, props] of propMaps) {
    map.set(name, propsToFormattingFlags(props));
  }
  return map;
}

function parseInlineStyleFormatting(styleAttr) {
  if (!styleAttr) return null;
  const flags = emptyFormattingFlags();
  if (/font-style\s*:\s*italic/i.test(styleAttr)) flags.italic = true;
  if (/font-weight\s*:\s*(?:bold|bolder|[6-9]00)\b/i.test(styleAttr)) {
    flags.bold = true;
  }
  if (/text-decoration\s*:\s*underline/i.test(styleAttr)) {
    flags.underline = true;
  }
  const ff = styleAttr.match(/font-family\s*:\s*([^;]+)/i);
  if (ff) flags.fontFamily = ff[1].trim();
  const fs = styleAttr.match(/font-size\s*:\s*([^;]+)/i);
  if (fs) flags.fontSize = fs[1].trim();
  // Avoid matching background-color.
  const colorM = styleAttr.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  if (colorM) flags.color = colorM[1].trim();
  return flags.italic ||
    flags.bold ||
    flags.underline ||
    flags.fontFamily ||
    flags.fontSize ||
    flags.color
    ? flags
    : null;
}

function resolveElementFormatting($el, classFormatting) {
  const flags = emptyFormattingFlags();
  const classes = ($el.attr("class") || "").split(/\s+/).filter(Boolean);
  for (const cls of classes) {
    const f = classFormatting.get(cls);
    if (!f) continue;
    if (f.italic) flags.italic = true;
    if (f.bold) flags.bold = true;
    if (f.underline) flags.underline = true;
    if (f.fontFamily) flags.fontFamily = f.fontFamily;
    if (f.fontSize) flags.fontSize = f.fontSize;
    if (f.color) flags.color = f.color;
  }
  const inline = parseInlineStyleFormatting($el.attr("style"));
  if (inline) {
    flags.italic = flags.italic || inline.italic;
    flags.bold = flags.bold || inline.bold;
    flags.underline = flags.underline || inline.underline;
    if (inline.fontFamily) flags.fontFamily = inline.fontFamily;
    if (inline.fontSize) flags.fontSize = inline.fontSize;
    if (inline.color) flags.color = inline.color;
  }
  return flags;
}

function applyDocInlineClasses($el, flags) {
  const fontClass = fontFamilyToDocClass(flags.fontFamily);
  const sizeClass = fontSizeToDocClass(flags.fontSize);
  const colorClass = colorToDocClass(flags.color);
  if (!fontClass && !sizeClass && !colorClass) return;
  const keep = ($el.attr("class") || "")
    .split(/\s+/)
    .filter(
      (c) =>
        !c.startsWith("doc-font-") &&
        !c.startsWith("doc-size-") &&
        !c.startsWith("doc-color-"),
    );
  if (fontClass) keep.push(fontClass);
  if (sizeClass) keep.push(sizeClass);
  if (colorClass) keep.push(colorClass);
  $el.attr("class", keep.join(" "));
}

function wrapStyledFormatting($, body, classFormatting) {
  body.find("[class],[style]").each((_, el) => {
    const $el = $(el);
    const flags = resolveElementFormatting($el, classFormatting);
    applyDocInlineClasses($el, flags);
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (/^h[1-6]$/.test(tag)) return;
    const inLink = tag === "a" || $el.closest("a").length > 0;
    const containsLink = $el.find("a").length > 0;
    const needsWrap =
      flags.italic ||
      flags.bold ||
      (flags.underline && !inLink && !containsLink);
    if (!needsWrap) return;
    let inner = $el.html() || "";
    if (!inner.trim()) return;
    if (flags.underline && !inLink) inner = `<u>${inner}</u>`;
    if (flags.italic) inner = `<em>${inner}</em>`;
    if (flags.bold) inner = `<strong>${inner}</strong>`;
    $el.html(inner);
  });
}

function unwrapGoogleRedirectorHref(href) {
  if (!href || typeof href !== "string") return href;
  if (!/^https?:\/\/(?:www\.)?google\.com\/url\?/i.test(href)) return href;
  try {
    const u = new URL(href);
    const q = u.searchParams.get("q");
    return q || href;
  } catch {
    return href;
  }
}

function unwrapAllGoogleRedirectors($, body) {
  body.find("a[href]").each((_, el) => {
    const $el = $(el);
    const orig = $el.attr("href");
    const cleaned = unwrapGoogleRedirectorHref(orig);
    if (cleaned !== orig) $el.attr("href", cleaned);
    const text = $el.text();
    if (text && text.trim() === orig) $el.text(cleaned);
  });
}

function convertDashDividersToHr($, body) {
  const dividerRe = /^[-*_\u2013\u2014]+$/;
  body.find("p").each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, "");
    if (text && dividerRe.test(text)) {
      $el.replaceWith("<hr />");
    }
  });
}

/**
 * Google publish HTML often splits one visually uniform heading into spans where
 * only part of the line inherits the doc-size class (e.g. "Chapter 2: Foo" bare,
 * "™" at 27pt, subtitle at 20pt). Propagate the chapter body size to unstyled
 * sibling spans so the reader matches Docs.
 */
function normalizeHeadingFontSizes($, body) {
  body.find("h1,h2,h3,h4,h5,h6").each((_, el) => {
    const $heading = $(el);
    let bodySize = null;
    $heading.find("[class]").addBack().each((_, node) => {
      const cls = $(node).attr("class") || "";
      const m = cls.match(/doc-size-(\d+)pt/);
      if (!m) return;
      const pt = parseInt(m[1], 10);
      // Skip trademark/superscript sizes; prefer 20pt chapter titles.
      if (pt >= 24) return;
      if (pt === 20 || !bodySize) bodySize = m[0];
    });
    if (!bodySize) return;
    $heading.find("span").each((_, node) => {
      const $span = $(node);
      const cls = $span.attr("class") || "";
      if (/doc-size-\d+pt/.test(cls)) return;
      $span.addClass(bodySize);
    });
  });
}

/**
 * Docs sometimes accidentally applies Heading 1 to long body paragraphs (product
 * blurbs, dialogue). Those become sidebar chapters and truncate serial publishes.
 * Demote obvious accidents to <p> before turndown.
 */
function demoteAccidentalHeadings($, body) {
  body.find("h1,h2,h3,h4,h5,h6").each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, " ").trim();
    if (!text) return;
    const accidental = text.length > 100 || /^[“"«]/.test(text);
    if (!accidental) return;
    $el.replaceWith(`<p>${$el.html() || ""}</p>`);
  });
}

export function extractBodyHtml(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const body = $(".doc-content").first();
  if (!body.length) return null;
  const classFormatting = parseStyleClassFormatting($);
  wrapStyledFormatting($, body, classFormatting);
  normalizeHeadingFontSizes($, body);
  demoteAccidentalHeadings($, body);
  unwrapAllGoogleRedirectors($, body);
  convertDashDividersToHr($, body);
  body.find("p").each((_, el) => {
    const $el = $(el);
    if (!$el.text().trim() && !$el.find("img,br").length) $el.remove();
  });
  body.find("span").each((_, el) => {
    const $el = $(el);
    if (!$el.attr("href") && !$el.text().length) $el.remove();
  });
  return body.html() || "";
}

export function postProcessMarkdown(md) {
  return (
    md
      // Scene tags must be bare, standalone paragraphs for the reader.
      .replace(
        /^(?:<span class="doc-(?:font|size|color)-[^"]*">\s*)*\[\[\s*scene\s*:([^\]]+)\]\]\s*(?:<\/span>\s*)*$/gim,
        "[[scene:$1]]",
      )
      .replace(/^\*\[\[scene:([^\]]+)\]\]\*$/gm, "[[scene:$1]]")
      // Ensure blank lines around scene tags so split(/\n\n+/) isolates them.
      .replace(/^(\[\[\s*scene\s*:[^\]]+\]\])[ \t]*$/gim, "\n$1\n")
      .replace(/^(\[\[scene:[^\]]+\]\]) +(\S.*)$/gm, "$1\n\n$2")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+$/gm, "")
      .trim() + "\n"
  );
}

export async function fetchDoc(url, attempt = 1) {
  const res = await fetch(url, { redirect: "follow" });
  if (res.status === 429 || res.status >= 500) {
    if (attempt < 4) {
      const wait = 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, wait));
      return fetchDoc(url, attempt + 1);
    }
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** @param {string} html - raw HTML from published doc fetch */
export function markdownFromPublishedHtml(html, td = makeTurndown()) {
  const inner = extractBodyHtml(html);
  if (inner == null) throw new Error("could not find .doc-content");
  if (!inner.trim()) throw new Error(".doc-content was empty");
  return postProcessMarkdown(td.turndown(inner));
}

export async function fetchMarkdownFromPublishUrl(url, td = makeTurndown()) {
  const html = await fetchDoc(url);
  return markdownFromPublishedHtml(html, td);
}
