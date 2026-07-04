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
        /\bdoc-(?:font|size)-/.test(node.getAttribute("class") || "")
      );
    },
    replacement(content, node) {
      const cls = (node.getAttribute("class") || "")
        .split(/\s+/)
        .filter((c) => c.startsWith("doc-font-") || c.startsWith("doc-size-"))
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
  };
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
  return flags.italic ||
    flags.bold ||
    flags.underline ||
    flags.fontFamily ||
    flags.fontSize
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
  }
  const inline = parseInlineStyleFormatting($el.attr("style"));
  if (inline) {
    flags.italic = flags.italic || inline.italic;
    flags.bold = flags.bold || inline.bold;
    flags.underline = flags.underline || inline.underline;
    if (inline.fontFamily) flags.fontFamily = inline.fontFamily;
    if (inline.fontSize) flags.fontSize = inline.fontSize;
  }
  return flags;
}

function applyDocInlineClasses($el, flags) {
  const fontClass = fontFamilyToDocClass(flags.fontFamily);
  const sizeClass = fontSizeToDocClass(flags.fontSize);
  if (!fontClass && !sizeClass) return;
  const keep = ($el.attr("class") || "")
    .split(/\s+/)
    .filter(
      (c) => !c.startsWith("doc-font-") && !c.startsWith("doc-size-"),
    );
  if (fontClass) keep.push(fontClass);
  if (sizeClass) keep.push(sizeClass);
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

export function extractBodyHtml(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const body = $(".doc-content").first();
  if (!body.length) return null;
  const classFormatting = parseStyleClassFormatting($);
  wrapStyledFormatting($, body, classFormatting);
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
      .replace(/^(\[\[scene:[^\]]+\]\]) +(\S.*)$/gm, "$1\n\n$2")
      .replace(/^\*\[\[scene:([^\]]+)\]\]\*$/gm, "[[scene:$1]]")
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
