/**
 * Image/scaffold hints for oe-product tooling.
 * Catalog copy (tagline, description, features) lives only in
 * over-easy-products/products.js — not here.
 */
export const PRODUCT_HINTS = {
  sterilizer: {
    kind: "device",
    category: "self-defense",
    badge: "Self Defense",
    displayName: "The Sterilizer™",
    model: "CBT-22120",
    imageNotes:
      "Black handheld taser, angled prods, snub nose, blue arc between prongs. Switch labeled LOW / MEDIUM / HIGH. Model CBT-22120 on body. White STERILIZER label.",
    referenceAssets: [
      "assets/scenes/andrea_and_lucas/overeasy_sterilizer_device_v3.png",
    ],
  },
  studclamp: {
    kind: "device",
    category: "discipline",
    badge: "Interrogation",
    displayName: "StudClamp™",
    imageNotes:
      "Matte-black C-clamp control unit, steel disc jaw pads, red LED, power button on top.",
    referenceAssets: [
      "assets/scenes/andrea_and_lucas/overeasy_studclamp_device_v2.png",
    ],
  },
  nutcracker: {
    kind: "device",
    category: "self-defense",
    badge: "EDC",
    displayName: "Ballcracker™",
    imageNotes:
      "Brushed steel cylinder, black ribbed grip, conical tip, keychain ring, BALLCRACKER label.",
    referenceAssets: [
      "assets/scenes/andrea_and_lucas/overeasy_nutcracker_device_v2.png",
    ],
  },
  "ball-killers": {
    kind: "fashion",
    category: "fashion",
    badge: "Fashion",
    displayName: "Ball Killers™",
    imageNotes:
      "Shiny black patent heel pair, blood-red soles, 'ball' and 'killer' in bright red on each shoe, tungsten-capped points at heel and toe.",
    referenceAssets: [
      "assets/scenes/andrea_and_lucas/overeasy_ball_killers_heels_v1.png",
    ],
  },
  "bleach-wipes": {
    kind: "packaging",
    category: "medical",
    badge: "Hygiene",
    displayName: "Bleach Wipes™",
    model: "OET-BW-40",
    imageNotes:
      "Retail wipe box, orange/white Over Easy branding, dense cartoony terrified sperm mascots with long tails being dissolved/wiped (PG cartoon).",
    referenceAssets: [
      "assets/scenes/andrea_and_lucas/overeasy_bleach_wipes_box_v2.png",
    ],
  },
  strapon: {
    kind: "device",
    category: "discipline",
    badge: "Premium",
    displayName: "'Selfish Bitch' Strap-On System",
    imageNotes:
      "Solid opaque matte-black rubber harness, heavy stiff false balls, minimal leather straps, internal g-spot bulb visible from angle, leather scrotum tether cuff, Over Easy logo. NO cutaway.",
    referenceAssets: [
      "assets/scenes/andrea_and_lucas/overeasy_strapon_device_v3.png",
    ],
  },
  "auto-milker": {
    kind: "device",
    category: "discipline",
    badge: "Security",
    displayName: "Auto-Milker™",
    model: "OET-AM-1",
    imageNotes:
      "Matte charcoal rubber cocksleeve + scrotum pouch, metal electrostim contacts inside pouch, WARMUP/EXTRACT toggles, collection hose to graduated vial, medical tray, Over Easy logo.",
    referenceAssets: [
      "assets/scenes/school_bully/overeasy_auto_milker_device_v1.png",
    ],
  },
  "biopsy-gun": {
    kind: "device",
    category: "medical",
    badge: "Medical",
    displayName: "Testicular Biopsy Gun™",
    imageNotes:
      "Beige pistol-grip biopsy gun, long coring needle, graduated rear vial.",
    referenceAssets: [
      "assets/scenes/andrea_and_lucas/testicular_biopsy_gun_device_v2.png",
    ],
  },
  "eunuchcorn-denim": {
    kind: "fashion",
    category: "fashion",
    badge: "Fashion",
    displayName: "EunuchCorn™ Denim",
    model: "OET-EC-D1",
    imageNotes:
      "Dark indigo EunuchCorn jeans and matching jean shorts flat lay, ultra-high seam, flat tight crotch, eunuch arch fit, Over Easy egg logo on back pocket.",
    referenceAssets: [
      "assets/scenes/andrea_and_lucas/overeasy_eunuchcorn_denim_v1.png",
    ],
  },
  "onenut-cup": {
    kind: "device",
    category: "medical",
    badge: "Protection",
    displayName: "OneNut© Cup",
    model: "OET-ONC-1",
    imageNotes:
      "Obviously lopsided athletic cup — one full dome chamber (rightie), other side completely flat and empty. OneNut branding, size M/RIGHTIE label.",
    referenceAssets: [
      "assets/scenes/andrea_and_lucas/overeasy_onenut_cup_v1.png",
    ],
  },
  "testicular-implants": {
    kind: "packaging",
    category: "medical",
    badge: "Cosmetic",
    displayName: "Testicular Implants™",
    model: "OET-TI-2",
    imageNotes:
      "Retail box with two skin-tone silicone cosmetic ovoid inserts, crossed-out icons for fertility/hormones/sensation, Over Easy branding.",
    referenceAssets: [
      "assets/scenes/andrea_and_lucas/overeasy_testicular_implants_v2.png",
    ],
  },
  "cherry-pop-album": {
    kind: "media",
    category: "media",
    badge: "Music",
    displayName: "Cherry Pop! — Plum Dumb & Permanently Done",
    model: "CP-PDPD-001",
    imageNotes:
      "CD jewel case and vinyl sleeve retail product shot displaying Plum Dumb & Permanently Done album cover art from reference.",
    referenceAssets: [
      "assets/scenes/andrea_and_lucas/cherry_pop_album_merch_v1.png",
      "assets/scenes/andrea_and_lucas/cherry_pop_album_cover_plum_dumb_mush_pit_ch08_11_v1.png",
    ],
  },
  "luna-identity-arm": {
    kind: "device",
    category: "discipline",
    badge: "Security",
    displayName: "Luna™ Identity Arm",
    model: "OET-LIA-1",
    imageNotes:
      "Wall-mounted brushed stainless elevator security panel, telescoping gunmetal robotic arm with red-glow ring scanner at tip, Luna wordmark on LCD, inset detail of mechanical hand gripping hypodermic needle.",
    referenceAssets: [
      "assets/scenes/andrea_and_lucas/overeasy_luna_identity_arm_device_v1.png",
    ],
  },
};

const LOGO = "assets/brands/overeasy_logo_v2_raw_eggs_minimal.png";

/**
 * @param {object} opts
 * @param {string} opts.productName
 * @param {string} opts.assetRelative
 * @param {string[]} opts.productSpecs — factual specs only, no story prose
 * @param {ReturnType<typeof getHints>} hints
 */
export function buildImagePrompt({
  productName,
  assetRelative,
  productSpecs,
  hints,
}) {
  const specBlock = productSpecs.length
    ? `\nPRODUCT SPECS (visual/design only — do not illustrate story scenes):\n${productSpecs.map((s) => `- ${s}`).join("\n")}\n`
    : "";

  const kind = hints.kind ?? "device";
  const base =
    kind === "packaging"
      ? "Product catalog photograph of Over Easy Technologies retail packaging"
      : kind === "fashion"
        ? "Product catalog photograph of Over Easy Technologies fashion product"
        : kind === "media"
          ? "Product catalog photograph of music merchandise"
          : "Product catalog photograph of Over Easy Technologies hardware";

  return `${base} — ${hints.displayName ?? productName}.

${hints.imageNotes ?? "Photo-real consumer product on white studio background."}
${specBlock}
BRANDING (required on every Over Easy product):
- Canonical raw-egg pictogram from logo reference: smashed raw egg left, cracked intact egg right (minimal line art — NOT smiley face, NOT fried eggs).
- Silkscreen, emboss, or print on product body/packaging beside OVER EASY TECHNOLOGIES wordmark where appropriate.

STYLE: Photo-real product photography, white or neutral studio background, sharp focus. No people, no story scenes, no characters. No on-image sound effects.

Save to: ${assetRelative.replace(/^\.\.\//, "")}
Use reference images when available. Never overwrite an existing file — this is a new versioned asset.`;
}

/** Alternate slugs when product display names don't slugify to catalog ids. */
const SLUG_ALIASES = {
  "over-easy-strap-on-system": "strapon",
  "shell-shaker": "strapon",
  "shell-shaker-strap-on-system": "strapon",
  "selfish-bitch-strap-on-system": "strapon",
  "testicular-biopsy-gun": "biopsy-gun",
  ballcracker: "nutcracker",
  "semen-extractor": "auto-milker",
  luna: "luna-identity-arm",
};

/** @param {string} slug */
export function getHints(slug, productName) {
  const key = SLUG_ALIASES[slug] ?? slug;
  if (PRODUCT_HINTS[key]) return { ...PRODUCT_HINTS[key], catalogId: key };
  return {
    kind: "device",
    category: "discipline",
    badge: "Hardware",
    displayName: productName.includes("™") ? productName : `${productName}™`,
    imageNotes: "Photo-real Over Easy product on white studio background.",
    referenceAssets: [],
  };
}

export function logoPath() {
  return LOGO;
}
