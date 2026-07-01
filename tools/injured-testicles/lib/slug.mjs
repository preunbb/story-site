/**
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 48);
}

/**
 * Strip common command prefixes from user input.
 * @param {string} raw
 * @returns {string}
 */
export function parseInjuryDescription(raw) {
  let text = raw.trim();
  const prefixes = [
    /^create\s+injured\s+testicles?\s*,?\s*/i,
    /^injured\s+testicles?\s*,?\s*/i,
    /^generate\s+injured\s+testicles?\s*,?\s*/i,
    /^make\s+injured\s+testicles?\s*,?\s*/i,
  ];
  for (const re of prefixes) {
    text = text.replace(re, "");
  }
  return text.trim();
}
