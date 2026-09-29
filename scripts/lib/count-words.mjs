/**
 * Count words in story markdown. HTML tags (doc-color spans, etc.) are
 * removed first; any remaining run of non-whitespace is one word (wc -w).
 */
export function countWords(md) {
  const stripped = String(md || "").replace(/<[^>]+>/g, " ");
  const trimmed = stripped.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
