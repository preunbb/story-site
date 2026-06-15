/**
 * Over Easy Technologies — product catalog config
 *
 * Edit this file to change copy, images, features, or add/remove products.
 * This is the single source of truth for catalog copy — oe-product tooling reads from here.
 * Paths are relative to over-easy-products/index.html
 *
 * New products: npm run oe-product -- "Product Name"
 *
 * Editor: word-wrap + no autocomplete — see .vscode/settings.json (oe-catalog language).
 * Format on save: installs Run on Save extension (see .vscode/extensions.json), or run npm run format:oe-catalog.
 */
window.OVER_EASY_CATALOG = {
  brand: {
    name: "Over Easy Technologies",
    tagline: "Premium lifestyle hardware for the modern woman.",
    logo: "../assets/brands/overeasy_logo_v2_raw_eggs_minimal.png",
    purchaseUrl: "https://ko-fi.com/s/edb2b8eaa5",
  },

  categories: [
    { id: "fashion", label: "Fashion" },
    { id: "media", label: "Media" },
    { id: "medical", label: "Medical Equipment" },
    { id: "self-defense", label: "Self Defense" },
    { id: "discipline", label: "Discipline & Security" },
  ],

  products: [
    {
      id: "ball-killers",
      category: "fashion",
      name: "Ball Killers™",
      model: "OET-BK-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_ball_killers_heels_v1.png",
      tagline:
        "Fashionable. Functional. Pointed.",
      description:
        "Self-defense you can wear to dinner. Glossy patent pumps with tungsten-tipped " +
        "points at heel and toe — as sexy on the dance floor as they are useful when " +
        "someone needs a very direct lesson in boundaries.",
      badge: "Fashion",
    },
    {
      id: "eunuchcorn-denim",
      category: "fashion",
      name: "EunuchCorn™ Denim",
      model: "OET-EC-D1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_eunuchcorn_denim_v1.png",
      tagline:
        "Jeans for those out of the gene pool.",
      description:
        "Finally — denim that fits what's left. EunuchCorn jeans and shorts feature an " +
        "ultra-high seam and extra-tight flat front: no embarrassing loose crotch, no " +
        "pointless zipper bulge, just the confident silhouette of a man who's already " +
        "said goodbye to his legacy. Available in high, medium, and low-slung eunuch " +
        "arch.",
      features: [
          "Jeans and jean shorts — same fit, your choice",
          "Confident, proud, unmistakeable EunuchCorn branding - so you can show off " +
          "your fashion sense and status as a eunuch to the world",
      ],
      sizeOptions: [
        { id: "arch", label: "Eunuch arch", options: [{ value: "high", label: "High-slung eunuch arch" }, { value: "medium", label: "Medium eunuch arch" }, { value: "low", label: "Low-slung eunuch arch" }] },
      ],
      badge: "Fashion",
    },
    {
      id: "cherry-pop-album",
      category: "media",
      name: "Cherry Pop! — Plum Dumb & Permanently Done",
      model: "CP-PDPD-001",
      image:
        "../assets/scenes/andrea_and_lucas/cherry_pop_album_merch_v1.png",
      tagline:
        "Live from the Mush Pit.",
      description:
        "The latest Cherry Pop! release — Plum Dumb & Permanently Done, recorded live " +
        "from their show at Brokeberry Mall. With microphones beneath every panel of " +
        "the dance floor, every pop and squick from the band's most legendary mush pit " +
        "is captured in perfect detail. Available on CD and vinyl.",
      features: [
          "Studio album: Plum Dumb & Permanently Done",
          "Live from the Mush Pit recording",
          "Tracks include Crushed to Bits, The Leafless Tree, Shredded Seed",
          "CD jewel case and vinyl sleeve editions",
          "Parental advisory: obvious if you've heard a track",
      ],
      badge: "Music",
    },
    {
      id: "biopsy-gun",
      category: "medical",
      name: "Testicular Biopsy Gun™",
      model: "OET-TBG-1",
      image:
        "../assets/scenes/andrea_and_lucas/testicular_biopsy_gun_device_v2.png",
      tagline:
        "Core samples on demand.",
      description:
        "Hospital-grade core instrument from our discontinued medical line. Pistol " +
        "grip, angled coring needle, and a graduated collection vial. #1 testicular " +
        "core sampler on the market. Vial detaches for recreational usage.",
      badge: "Medical",
    },
    {
      id: "bleach-wipes",
      category: "medical",
      name: "Bleach Wipes™",
      model: "OET-BW-40",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_bleach_wipes_box_v2.png",
      tagline:
        "Snuff out the breeding hazard.",
      description:
        "Patented bleach wipes strong enough to neutralize every germ — and every " +
        "ambitious swimmer — they touch, yet gentle enough for your most delicate bits. " +
        "Essential for cleaning up any serious breeding hazard",
      features: [
          "Neutralizes bacteria and sperm on contact — skin, fabric, or floor",
          "Deep-clean safe for post-encounter sensitive areas",
      ],
      sizeOptions: [
        { id: "pack-size", label: "Pack size", options: [{ value: "purse", label: "30-count purse-sized pack" }, { value: "home", label: "1,000-count home usage" }, { value: "bulk", label: "50,000-count bulk sterilization commercial packs" }] },
      ],
      badge: "Hygiene",
    },
    {
      id: "onenut-cup",
      category: "medical",
      name: "OneNut© Cup",
      model: "OET-ONC-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_onenut_cup_v1.png",
      tagline:
        "Snug for what survived.",
      description:
        "For men with only one remaining testicle, standard cups leave too much room — " +
        "your lone survivor bounces, pinches, and slides into the gap. OneNut© cups are " +
        "molded just for you, to protect what little you have left.",
      sizeOptions: [
        { id: "orientation", label: "Orientation", options: [{ value: "left", label: "Leftie" }, { value: "right", label: "Rightie" }] },
        { id: "cup-size", label: "Cup size", options: [{ value: "xxxs", label: "XXXS" }, { value: "xxs", label: "XXS" }, { value: "xs", label: "XS" }, { value: "s", label: "S" }, { value: "m", label: "M" }, { value: "l", label: "L" }, { value: "xl", label: "XL" }] },
      ],
      badge: "Protection",
    },
    {
      id: "testicular-implants",
      category: "medical",
      name: "Testicular Implants™",
      model: "OET-TI-2",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_testicular_implants_v2.png",
      tagline:
        "Look the part. Feel nothing.",
      description:
        "Lost something precious? These cosmetic replacements restore the outline — and " +
        "absolutely nothing else. No hormones. No fertility. No sensation. Just a " +
        "convincingly full profile for the man who wants to pretend he's still packing " +
        "asiodjfaasiodjfaasiodjfaasiodjfaasiodjfaasiodjfaheat while everyone who knows " +
        "him smirks.",
      sizeOptions: [
        { id: "implant-size", label: "Implant size", options: [{ value: "xxxs", label: "XXXS" }, { value: "xxs", label: "XXS" }, { value: "xs", label: "XS" }, { value: "s", label: "S" }, { value: "m", label: "M", soldOut: true }, { value: "l", label: "L", soldOut: true }] },
      ],
      badge: "Cosmetic",
    },
    {
      id: "sterilizer",
      category: "self-defense",
      name: "The Sterilizer™",
      model: "CBT-22120",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_sterilizer_device_v3.png",
      tagline:
        "One zap. Zero contributions.",
      description:
        "The first personal defense tool engineered to fit exactly where he's most " +
        "vulnerable. Angled prods and a snub-nose body slide between the legs; three " +
        "power settings let you choose how permanently you remove him from the gene " +
        "pool — from a month-long pause to a forever farewell.",
      features: [
          "Three-position selector: LOW / MEDIUM / HIGH",
          "LOW — temporary fertility pause (~1 month) from one second of contact",
          "MEDIUM — lasting structural damage; he'll feel the reminder every time",
          "HIGH — irreversible exit from the breeding market in five seconds",
          "Angled prods for precise below-the-belt contact",
          "Model CBT-22120",
      ],
      badge: "Self Defense",
    },
    {
      id: "nutcracker",
      category: "self-defense",
      name: "Ballcracker™",
      model: "OET-BC-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_nutcracker_device_v2.png",
      tagline:
        "Pocket-sized permanence.",
      description:
        "Brushed stainless pocket tool with a ribbed grip and a conical business end. " +
        "Goes beyond a warning — helps you take his family tree apart, one decisive " +
        "motion at a time. Keychain included.",
      features: [
          "Brushed steel body, black rubber grip",
          "Single flush activation button",
          "Tapered impact head",
          "Keychain attachment for everyday carry",
      ],
      badge: "EDC",
    },
    {
      id: "studclamp",
      category: "discipline",
      name: "StudClamp™",
      model: "OET-SC-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_studclamp_device_v2.png",
      tagline:
        "Dial the pressure. Watch the readout.",
      description:
        "Matte-black precision clamp with polished steel disc pads and app-connected " +
        "compression control. One clamp is usually enough — you'll know exactly when " +
        "he's given you what you need.",
      features: [
          "Available in single, or double pairing configurations for synchronized " +
          "compression.",
          "If you have a need for a triple pairing or more, contact Over Easy " +
          "technologies directly for a custom order (and we'd really like to meet him!)",
      ],
      badge: "Interrogation",
    },
    {
      id: "auto-milker",
      category: "discipline",
      name: "Auto-Milker™",
      model: "OET-AM-1",
      image:
        "../assets/scenes/school_bully/overeasy_auto_milker_device_v1.png",
      tagline:
        "When he says he's empty — prove him wrong.",
      description:
        "Clinical-grade semen extraction for when a handjob misses the cup or the donor " +
        "insists he's tapped out. Slip the molded rubber sleeve over him, seal the " +
        "scrotum pouch, and let electrostimulation plus precision compression wring out " +
        "every last drop — usually in two or three minutes, even from inmates on a " +
        "once-a-month allowance. Pleasure not guaranteed.",
      features: [
          "Vacuum-seal fit: rubber chamber adapts to anatomy on activation",
          "Electrostimulation contacts plus rhythmic scrotal compression",
          "WARMUP and EXTRACT controls; collection hose to graduated vial",
          "Cocksleeve vacuum routes fluid directly to sample cap",
          "Calibrated for institutional throughput",
      ],
      sizeOptions: [
        { id: "sleeve-fit", label: "Sleeve fit", options: [{ value: "micro", label: "1–3\" erections (micropenis)" }, { value: "below-avg", label: "3–5\" erections (below average)" }, { value: "average", label: "5–7\" erections (average)" }, { value: "above-avg", label: "7–9\" erections (slightly above average)" }, { value: "preference", label: "9–11\" erections (standard female preference)" }] },
      ],
      badge: "Security",
    },
    {
      id: "strapon",
      category: "discipline",
      name: "'Selfish Bitch' Strap-On System",
      model: "OET-SS-PRO",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_strapon_device_v3.png",
      tagline:
        "Heavy hardware. Total control.",
      description:
        "With its dual-ended piezoreactive automechanical architecture, this strap-on " +
        "lets you feel everything he does as you rearrange his guts. Osmium filled " +
        "false balls hang below for maximum weight, and the internal g-spot bulb keeps " +
        "you locked in even when you're pounding his hole as hard as you can.",
      features: [
          "Dual-ended: external shaft plus internal g-spot bulb for wearer stability " +
          "and pleasure",
          "Extra dense false testicles for heft and impact",
      ],
      badge: "Premium",
    },
    {
      id: "luna-identity-arm",
      category: "discipline",
      name: "Luna™ Identity Arm",
      model: "OET-LIA-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_luna_identity_arm_device_v1.png",
      tagline:
        "She passes. He explains.",
      description:
        "Wall-mounted access control for spaces that cannot afford ambiguity. Equipped " +
        "with a discreet vulva scanner for female entrants, Luna's built-in AI " +
        "automatically reconfigures her for male scans. With a carbon-nanofiger " +
        "articulated grip, precision AI guided internal extraction needle, she'll make " +
        "absolute sure he is who he says he is - even if she has to rearrange his " +
        "babymakers from the inside out to prove it. Autocauterization attachment can " +
        "be configured to minimize spermatic degradation.",
      features: [
          "Telescoping multi-joint arm — zigzag articulation reaches exactly where " +
          "verification requires",
          "Feminine pass mode: sub-second identity retrieval, minimally invasive Male " +
          "escort mode: firm mechanical hand plus hypodermic needle — stirs until his " +
          "inventory checks out",
          "Luna™ voice assistant manages credentials, clearance tiers, and " +
          "uncomfortable follow-up questions",
          "Reconfigures from scanner to below-the-belt audit in under two seconds",
          "Institutional install kit for elevators, vault doors, and private suites",
          "Model OET-LIA-1",
      ],
      badge: "Security",
    }
  ],
};
