/**
 * Optional / fetish-gated story passages ([[optional:id|summary]] … [[/optional]]).
 * Mirrors the parser in script.js for PDF/EPUB export.
 */

const OPTIONAL_OPEN_LINE_RE =
  /^\[\[\s*optional\s*:\s*([^\]|]+)(?:\|(.*))?\s*\]\]$/i;
const OPTIONAL_CLOSE_LINE_RE = /^\[\[\s*\/\s*optional\s*\]\]$/i;

/**
 * @returns {{ type: 'normal' | 'optional', markdown: string, id?: string, summary?: string }[]}
 */
export function splitOptionalContentRegions(markdown) {
  const text = String(markdown || "");
  if (!/\[\[\s*optional\s*:/i.test(text)) {
    return [{ type: "normal", markdown: text }];
  }
  const lines = text.split("\n");
  const segments = [];
  const normalBuf = [];
  let i = 0;

  function flushNormal() {
    if (normalBuf.length) {
      segments.push({ type: "normal", markdown: normalBuf.join("\n") });
      normalBuf.length = 0;
    }
  }

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    const open = trimmed.match(OPTIONAL_OPEN_LINE_RE);
    if (open) {
      flushNormal();
      const id = open[1].trim();
      const summary = (open[2] || "").trim();
      i += 1;
      const bodyLines = [];
      while (i < lines.length) {
        if (OPTIONAL_CLOSE_LINE_RE.test(lines[i].trim())) {
          i += 1;
          break;
        }
        bodyLines.push(lines[i]);
        i += 1;
      }
      segments.push({
        type: "optional",
        id,
        summary,
        markdown: bodyLines.join("\n"),
      });
    } else {
      normalBuf.push(lines[i]);
      i += 1;
    }
  }
  flushNormal();
  return segments;
}

/** Markdown with optional gates removed — bodies kept for print/export. */
export function expandOptionalContentMarkdown(markdown) {
  const regions = splitOptionalContentRegions(markdown);
  if (regions.length === 1 && regions[0].type === "normal") {
    return markdown;
  }
  return regions
    .map((r) => r.markdown)
    .filter((s) => s && s.trim().length > 0)
    .join("\n\n");
}