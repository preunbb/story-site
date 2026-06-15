/**
 * Over Easy catalog copy voice — female buyer audience, coy implication, no lore.
 */

export const COPY_VOICE_RULES = `
CATALOG COPY RULES (over-easy-products/products.js):

Audience: women shopping Over Easy — confident, amused, in on the joke.

Voice:
- Second person ("you") where natural; empowerment and lifestyle framing.
- Coy implication of testicular consequences — NEVER graphic, NEVER name body parts directly in marketing copy.
- Euphemisms: gene pool, family tree, his "contributions", delicate anatomy, lasting impression, firm message, breeding hazard, below-the-belt confidence, permanent reminder, take him off the market.

Forbidden in published catalog copy:
- Character names (Izzie, Abby, Lucas, Andrea, Kay, etc.)
- Specific story events, chapters, skits, rites, or scenes
- Direct quotes from fiction
- Clinical or pornographic explicitness

Story excerpts are research-only — extract product specs, not prose to paste.
`.trim();

/** Capitalized names common in catalog fiction — strip from spec mining. */
const NAME_BLOCKLIST =
  /\b(Izzie|Andrea|Lucas|Abby|Kay|Eve|Tamara|Yvette|Melody|Cathy|Bridget|Emma|Fiona|Sunni|Felix|Judah|Elijah|Isaac|Nate|Robert|James|Hunter|Ryan|Sam|Jenny|Karen|Cathy|Olivia|Zennia)\b/gi;

/**
 * Pull product specs from story research — facts only, no narrative.
 * @param {{ text: string }[]} excerpts
 */
export function extractProductSpecs(excerpts) {
  const blob = excerpts
    .map((e) => e.text)
    .join("\n")
    .replace(NAME_BLOCKLIST, "")
    .replace(/["“][^"”]+["”]/g, "") // drop dialogue
    .replace(/\s+/g, " ");

  /** @type {string[]} */
  const specs = [];

  const patterns = [
    [/low(?:est)?\s+(?:setting|power|mode)/i, "Three-position selector: LOW / MEDIUM / HIGH"],
    [/medium\s+(?:power|mode|setting)/i, "MEDIUM mode for a lasting impression he won't forget"],
    [/high\s+(?:power|setting|mode)/i, "HIGH mode — permanent removal from the gene pool"],
    [/LOW\s*\/\s*MEDIUM\s*\/\s*HIGH/i, "Three-position selector: LOW / MEDIUM / HIGH"],
    [/tungsten/i, "Tungsten-capped contact points"],
    [/bluetooth/i, "Bluetooth app pairing"],
    [/angled prod/i, "Angled prods for precise below-the-belt contact"],
    [/snub nose/i, "Snub-nose body designed to fit where it matters"],
    [/infertile|infertility|sperm-free|zero sperm/i, "Temporary to permanent fertility impact depending on setting"],
    [/bleach|sperm|germ/i, "Neutralizes germs and his little swimmers on contact"],
    [/gentle enough.*delicate/i, "Gentle on your most delicate areas"],
    [/c-?clamp|disc pad/i, "Steel disc compression jaws"],
    [/keychain/i, "Keychain-ready for everyday carry"],
    [/blood-red sole|patent black|patent/i, "Glossy patent finish with statement red soles"],
    [/stiletto|heel/i, "Stiletto profile — sexy on the dance floor, decisive everywhere else"],
    [/biopsy|coring needle/i, "Precision coring needle for tissue samples"],
    [/graduated.*vial|collection vial/i, "Graduated rear collection vial"],
    [/leather harness|strap-on/i, "Leather harness with adjustable hardware"],
  ];

  const seen = new Set();
  for (const [re, line] of patterns) {
    if (re.test(blob) && !seen.has(line)) {
      seen.add(line);
      specs.push(line);
    }
  }

  return specs;
}

/**
 * @param {object} opts
 * @param {string} opts.slug
 * @param {ReturnType<import("./prompts.mjs").getHints>} opts.hints
 * @param {string[]} opts.specs
 */
export function buildMarketingCopy({ slug, hints, specs }) {
  if (hints.marketing) {
    const features = [...hints.marketing.features];
    for (const s of specs) {
      if (!features.some((f) => f.toLowerCase().includes(s.slice(0, 20).toLowerCase()))) {
        features.push(s);
      }
    }
    return { ...hints.marketing, features: features.slice(0, 6) };
  }

  const displayName = hints.displayName ?? "Over Easy product";
  const kind = hints.kind ?? "device";

  const taglines = {
    device: "Engineered for when hints aren't enough.",
    fashion: "Cute shoes. Unambiguous message.",
    packaging: "Clean up the evidence — and the evidence.",
  };

  const descriptions = {
    device: `${displayName} — Over Easy hardware for the woman who prefers a firm answer to awkward situations. Discreet enough to carry, decisive enough that he won't need a second explanation.`,
    fashion: `${displayName} — because self-defense should match your outfit. Look incredible; leave a lasting impression on anything unfortunate enough to be standing in the wrong place.`,
    packaging: `${displayName} — for when the night went well for you and shouldn't leave a legacy for anyone else. Patented formula; surprisingly gentle where you need it.`,
  };

  const defaultFeatures = [
    "Canonical Over Easy raw-egg pictogram branding",
    "Designed for confident everyday carry",
    ...specs.slice(0, 4),
  ];

  return {
    tagline: taglines[kind] ?? taglines.device,
    description: descriptions[kind] ?? descriptions.device,
    features: defaultFeatures.length > 2 ? defaultFeatures : [
      "Canonical Over Easy raw-egg pictogram branding",
      "Edit features in over-easy-products/products.js",
    ],
  };
}

/** @deprecated use buildMarketingCopy */
export function draftCopyFromExcerpts(excerpts, hints = {}) {
  const specs = extractProductSpecs(excerpts);
  return buildMarketingCopy({
    slug: hints.slug ?? "",
    hints,
    specs,
  });
}
