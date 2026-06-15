/** @param {string} name */
export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/™|®/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** @param {string} slug */
export function modelCode(slug) {
  const abbrev = slug
    .split("-")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return `OET-${abbrev || "X"}-1`;
}

/** @param {string} slug @param {string} kind */
export function assetBasename(slug, kind = "device") {
  if (slug === "biopsy-gun" || slug === "testicular-biopsy-gun") {
    return "testicular_biopsy_gun";
  }
  if (kind === "packaging" || slug.includes("wipe")) {
    return `overeasy_${slug.replace(/-/g, "_")}_box`;
  }
  if (kind === "fashion" || slug.includes("ball-killer")) {
    return `overeasy_${slug.replace(/-/g, "_")}`;
  }
  return `overeasy_${slug.replace(/-/g, "_")}_${kind}`;
}
