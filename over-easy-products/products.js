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
    { id: "sex-toys", label: "Sex Toys" },
    { id: "kitchen-gadgets", label: "Kitchen Gadgets" },
    { id: "skill-training", label: "Skill Training" },
  ],

  products: [
    {
      id: "ball-killers",
      category: "fashion",
      name: "Ball Killers™",
      model: "OET-BK-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_ball_killers_heels_v1.png",
      images: [
        { path: "../assets/scenes/andrea_and_lucas/overeasy_ball_killers_heels_v1.png", caption: "Ball Killers™ — patent pumps on white background" },
        { path: "../assets/ballkiller.png", caption: "As stylish as they are dangerous, these functional heels will keep you sexy and safe." },
      ],
      tagline:
        "Fashionable. Functional. Pointed.",
      description:
        "Self-defense you can wear to dinner. Glossy patent pumps with tungsten-tipped " +
        "points at heel and toe — as sexy on the dance floor as they are useful when " +
        "someone needs a very direct lesson in boundaries. Be sure to clean thoroughly " +
        "between uses!",
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
        "said goodbye to his legacy.",
      features: [
          "Jeans and jean shorts — same fit, your choice",
          "Confident, proud, unmistakeable EunuchCorn branding - so you can show off " +
          "your fashion sense and status as a eunuch to the world",
      ],
      sizeOptions: [
        { id: "arch", label: "Pants type", options: [{ value: "ultra-short", label: "Ultra-short SackShower edition (for the especially confident eunuch)" }, { value: "short", label: "Booty shorts" }, { value: "full length", label: "Full-length jeans" }] },
        { id: "arch", label: "Eunuch arch", options: [{ value: "high", label: "High-slung eunuch arch" }, { value: "medium", label: "Medium eunuch arch" }, { value: "low", label: "Low-slung eunuch arch" }] },
      ],
    },
    {
      id: "bronze-trophy-earrings",
      category: "fashion",
      name: "Nevermore™ Keepsakes Custom-Made Bronze Earrings",
      model: "OET-BTE-1",
      image:
        "../assets/wearing_bronze.png",
      images: [
        { path: "../assets/scenes/one_night_stand/overeasy_bronze_testicle_earrings_v1.png", caption: "Every pair of Nevermore™ Keepsakes is completely unique." },
        { path: "../assets/scenes/one_night_stand/overeasy_nevermore_keepsakes_two_pairs_men_cringing_v1.png", caption: "Why settle for one trophy when you can collect a whole set? She wears the smile; they wear the regret." },
        { path: "../assets/asdf.png", caption: "Nevermore™ aren't just for high fashion - her son's Keepsakes on her ears answers all those pesky questions about why she doesn't have grandkids yet." },
        { path: "../assets/nurse_bronze.png", caption: "Even appropriate for the professional woman, Nurse Sarah subtly brags to her coworkers about her husband's devotion via her Nevermores™" },
        { path: "../assets/wearing_bronze.png", caption: "Model Asta wears her newest set of Nevermore™ Keepsakes, given to her by her latest one night stand (whose name unfortunately escapes her)." },
        { path: "../assets/college bronze.png", caption: "Lucia is embarassed to admit it, but deep down she loves being the first of her friends to get her own pair of Nevermores™ - she really has the best boyfriend on campus!" },
        { path: "../assets/mom_earring.png", caption: "Don't be distracted if your new date is wearing a pair of Nevermore™ Keepsakes - it just means she'll expect a little more from you than most woman." },
      ],
      tagline:
        "His loss is your gain.",
      description:
        "The problem with those beautiful nights of passion is that they don't last. " +
        "Over Easy's bronzing services give you a permanent reminder of that most " +
        "memorable moment in the life of your husband, partner, or one night stand.",
    },
    {
      id: "church-broken-tree-pendant",
      category: "fashion",
      name: "Church of the Broken Tree Devotional Pendant",
      model: "CBT-PND-1",
      image:
        "../assets/scenes/andrea_and_lucas/church_broken_tree_pendant_product_v1.png",
      images: [
        { path: "../assets/scenes/andrea_and_lucas/church_broken_tree_pendant_product_v1.png", caption: "Devotional pendant — pewter on silver cable chain" },
        { path: "../assets/characters/kay_final.png", caption: "Model: Kay" },
        { path: "../assets/characters/abby_final.png", caption: "Model: Abby" },
      ],
      tagline:
        "Wear your faith where he can see it.",
      description:
        "For the spiritual girl who wants a reminder of the Goddess's promise - that " +
        "what hangs between his legs was never meant to last.",
    },
    {
      id: "cherry-pop-album",
      category: "media",
      name: "Cherry Pop! — Plum Dumb & Permanently Done",
      model: "CP-PDPD-001",
      image:
        "../assets/scenes/andrea_and_lucas/cherry_pop_album_cover_product_v1.png",
      images: [
        { path: "../assets/scenes/andrea_and_lucas/cherry_pop_album_cover_product_v1.png", caption: "Album cover — Plum Dumb & Permanently Done" },
        { path: "../assets/scenes/andrea_and_lucas/cherry_pop_album_vinyl_record_v1.png", caption: "Vinyl LP" },
        { path: "../assets/scenes/andrea_and_lucas/cherry_pop_album_cd_jewel_v1.png", caption: "CD jewel case" },
      ],
      tagline:
        "Live from the Mush Pit.",
      description:
        "The latest Cherry Pop! release — Plum Dumb & Permanently Done, recorded live " +
        "from their show at Brokeberry Mall. With microphones beneath every panel of " +
        "the dance floor, every pop and squick from the band's most legendary mush pit " +
        "is captured in perfect audio fidelity. Available on CD and vinyl.",
      features: [
          "Parental advisory: Explicit Content",
      ],
    },
    {
      id: "gonadal-integrity-poster",
      category: "media",
      name: "Comparative Gonadal Integrity Poster",
      model: "OET-GIP-24",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_comparative_gonadal_integrity_poster_realistic_v1.png",
      images: [
        { path: "../assets/scenes/andrea_and_lucas/overeasy_comparative_gonadal_integrity_poster_realistic_v1.png", caption: "Current edition — full-color anatomical plate" },
        { path: "../assets/scenes/andrea_and_lucas/overeasy_comparative_gonadal_integrity_poster_v1.png", caption: "Vintage edition — sepia medical engraving" },
      ],
      tagline:
        "Before. After. On your wall.",
      description:
        "For the classy, intellectual castratrix, or just any woman who wants to learn " +
        "about the specifics of his testicular organs. Shows a testicle before and " +
        "after its rupture, in full-color or sepia editions. Custom posters available; " +
        "make sure to book your appointment with an OverEasy sales representative to " +
        "coincide with when you plan on popping him.",
      sizeOptions: [
        { id: "edition", label: "Edition", options: [{ value: "full-color", label: "Full-color anatomical plate", imageIndex: 0 }, { value: "sepia", label: "Vintage sepia medical engraving", imageIndex: 1 }, { value: "custom", label: "Custom printed photorealistic copy (requires booking a home visit from an OverEasy sales representative to meet the unlucky boyfriend or husband)", disabled: true }] },
      ],
    },
    {
      id: "hypersecretory-disorder-poster",
      category: "media",
      name: "Hypersecretory Disorder Clinical Poster",
      model: "OET-HSD-24",
      image:
        "../assets/scenes/andrea_and_lucas/lucas_hyperspermia_scrotum_textbook_diagram_v2.png",
      description:
        "Vintage textbook plate illustrating the effects of 'hypersecretory disorder', " +
        "an antiquated name for what doctors now call 'hyperactive testicular " +
        "disorder'. A great gift for the man who insists he has this mythical condition " +
        ".",
    },
    {
      id: "biopsy-gun",
      category: "medical",
      name: "Testicular Biopsy Gun™",
      model: "OET-TBG-1",
      image:
        "../assets/scenes/andrea_and_lucas/testicular_biopsy_gun_device_v2.png",
      description:
        "Hospital-grade instrument for removing testicular tissue samples for analysis. " +
        "Extra thick collection needle ensures adequate retrieval for even the toughest " +
        "diagnoses. For recrational usage instead of sampling, simply detach the " +
        "removable vial.",
    },
    {
      id: "bleach-wipes",
      category: "medical",
      name: "Bleach Wipes™",
      model: "OET-BW-40",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_bleach_wipes_box_v2.png",
      tagline:
        "Snuff out those swimmers!",
      description:
        "Patented bleach wipes strong enough to neutralize every germ and ambitious " +
        "future heir they touch, yet gentle enough for your most delicate bits. " +
        "Essential for cleaning up any serious breeding hazard after a night of fun " +
        "with a boy.",
      features: [
          "Neutralizes bacteria and sperm on contact — skin, fabric, or floor",
          "Safe for any vaginal PH, so you can really scrub deep and avoid any awkward " +
          "pregnancies",
      ],
      sizeOptions: [
        { id: "pack-size", label: "Pack size", options: [{ value: "purse", label: "30-count purse-sized pack" }, { value: "home", label: "1,000-count home usage pack" }, { value: "bulk", label: "50,000-count bulk sterilization commercial packs" }] },
      ],
    },
    {
      id: "onenut-cup",
      category: "medical",
      name: "OneNut© Cup",
      model: "OET-ONC-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_onenut_cup_v1.png",
      tagline:
        "Better safe than sorry.",
      description:
        "For men with only one remaining testicle, standard cups leave too much room — " +
        "your lone survivor bounces, pinches, and slides into the gap. OneNut© cups are " +
        "molded just for you, to protect what little you have left.",
      sizeOptions: [
        { id: "orientation", label: "Orientation", options: [{ value: "left", label: "Leftie" }, { value: "right", label: "Rightie" }] },
        { id: "cup-size", label: "Cup size", options: [{ value: "xxxs", label: "XXXS" }, { value: "xxs", label: "XXS" }, { value: "xs", label: "XS" }, { value: "s", label: "S" }, { value: "m", label: "M" }, { value: "l", label: "L" }, { value: "xl", label: "XL" }] },
      ],
    },
    {
      id: "testicular-implants",
      category: "medical",
      name: "Contour Restoration Inserts™",
      model: "OET-TI-2",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_testicular_implants_v2.png",
      tagline:
        "Look the part. Feel nothing.",
      description:
        "Lost something precious? These cosmetic replacements restore the outline — and " +
        "absolutely nothing else. No hormones. No fertility. No sensation. Just a " +
        "convincingly full profile for the man who wants to pretend he's still packing " +
        "heat.",
      sizeOptions: [
        { id: "implant-size", label: "Implant size", options: [{ value: "xxxs", label: "XXXS" }, { value: "xxs", label: "XXS" }, { value: "xs", label: "XS" }, { value: "s", label: "S", soldOut: true }, { value: "m", label: "M", soldOut: true }, { value: "l", label: "L", soldOut: true }] },
      ],
    },
    {
      id: "sterilizer",
      category: "self-defense",
      name: "The Sterilizer™",
      model: "CBT-22120",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_sterilizer_device_v3.png",
      images: [
        { path: "../assets/scenes/andrea_and_lucas/overeasy_sterilizer_device_v3.png", caption: "Sterilizer™ CBT-22120 — angled prods, three-setting voltage selector" },
        { path: "../assets/scenes/andrea_and_lucas/overeasy_sterilizer_crosssection_voltage_graded_v3.png", caption: "Voltage-graded injury — LOW, MEDIUM, and HIGH, with cross-sections to show the devastating internal effects." },
        { path: "../assets/scenes/andrea_and_lucas/overeasy_sterilizer_crosssection_voltage_graded_v2_schematic.png", caption: "Boring medical details - but very helpful for his urologist to understand the severity of his injuries after you've done what you need to keep yourself safe." },
      ],
      tagline:
        "One zap. Zero kids.",
      description:
        "The first personal taser engineered to fit exactly where he's most vulnerable. " +
        "Angled prods and a snub-nose body slide between the legs; three power settings " +
        "let you choose how permanently you remove him from the gene pool — from a " +
        "month-long pause to a forever farewell.",
      features: [
          "Three voltage settings - YOU choose how much you reduce his sperm count!",
          "Angled prods for precise contact with the most productive regions of his " +
          "testicles",
      ],
    },
    {
      id: "nutcracker",
      category: "self-defense",
      name: "The Ballcracker™",
      model: "OET-BC-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_nutcracker_device_v2.png",
      images: [
        { path: "../assets/scenes/andrea_and_lucas/overeasy_nutcracker_device_v2.png", caption: "Ballcracker™ OET-BC-1 — brushed steel, ribbed grip, keychain-ready" },
        { path: "../assets/scenes/andrea_and_lucas/overeasy_ballcracker_crosssection_pneumatic_epididymis_v2_schematic.png", caption: "In-depth trauma mechanism - subtly crack him open by hand, or pop him instantly" },
      ],
      tagline:
        "Pocket-sized permanence.",
      description:
        "Brushed stainless pocket popper for the self-defense enthusiast on the go. " +
        "Dismantle his family tree slowly and intentionally with the pointed end, or " +
        "give him a quick ejection from the genepool with its pneumatic bolt. Keychain " +
        "included.",
      features: [
          "Rubber grip for comfortable handling",
          "Keychain attachment for everyday carry",
      ],
    },
    {
      id: "bell-ringer",
      category: "self-defense",
      name: "The BellRinger™",
      model: "OET-BR-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_bell_ringer_device_v1.png",
      images: [
        { path: "../assets/scenes/andrea_and_lucas/overeasy_bell_ringer_device_v1.png", caption: "Small enough to fit dozens in your purse, ensuring you're never caught without a fresh BellRinger™." },
        { path: "../assets/scenes/andrea_and_lucas/overeasy_bell_ringer_resonant_field_poster_realistic_v1.png", caption: "Wide range and depth of effect ensures the BellRinger™ can keep a whole room of men on their knees until deactivated." },
        { path: "../assets/scenes/andrea_and_lucas/overeasy_bell_ringer_resonant_field_poster_vintage_v1.png", caption: "Vintage and modern product posters available for purchase upon request." },
      ],
      tagline:
        "Really resonates with a lot of boys.",
      description:
        "Sleek palm-sized orb that emits focused subsonic pulses. With vibration " +
        "frequency precisely tuned to the exact resonant frequency of testicular " +
        "matter, one BellRinger can keep a whole room of men on their knees until " +
        "deactivated. Useful for defending yourself from multiple male attackers at " +
        "once, getting through long lines quickly, or just clearing some personal space " +
        "for yourself on a crowded subway.",
      features: [
          "Warning: effects have not been tested on women!",
      ],
    },
    {
      id: "studclamp",
      category: "discipline",
      name: "StudClamp™",
      model: "OET-SC-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_studclamp_device_v2.png",
      images: [
        { path: "../assets/scenes/andrea_and_lucas/overeasy_studclamp_device_v2.png", caption: "StudClamp™ mobile app and compatible smart phone required for full functionality" },
        { path: "../assets/scenes/andrea_and_lucas/overeasy_gonadal_integrity_intact_studclamp_flattened_crosssection_v1.png", caption: "Artist's rendition of the cross-section of the subject during his successful StudClamp™ interrogation." },
      ],
      tagline:
        "Squeeze it out of him.",
      description:
        "Matte-black precision clamp with polished steel disc pads and app-connected " +
        "compression control. Perfect for extracting information and confessions from " +
        "disobedient men.",
      sizeOptions: [
        { id: "pairing", label: "Configuration", options: [{ value: "one", label: "One-nut" }, { value: "two", label: "Two-nut" }, { value: "three", label: "Three-nut — contact Over Easy directly (we'd really like to meet him!)", soldOut: true }] },
      ],
    },
    {
      id: "auto-milker",
      category: "medical",
      name: "Auto-Milker™",
      model: "OET-AM-1",
      image:
        "../assets/scenes/school_bully/overeasy_auto_milker_device_v1.png",
      images: [
        { path: "../assets/scenes/school_bully/overeasy_auto_milker_device_v1.png", caption: "Auto-Milker™ OET-AM-1 — electrostim sleeve, scrotal compression, graduated collection vial" },
        { path: "../assets/automilker_in_use.png", caption: "Nurse Yvette after a cumpletely successful extraction. She's made sure to collect absolutely every last drop of semen from her lucky patient!" },
      ],
      tagline:
        "When he says he's empty — prove him wrong.",
      description:
        "Clinical-grade semen extraction for when a donor misses the cup or claims he's " +
        "already tapped out.Originally built for prisoner extractions and automated " +
        "release scheduling, we've used our rigorous quality control process to ensure " +
        "it's now safe for home and medical use! Ultrahigh electrostimulation plus " +
        "precision compression make sure you wring out every last drop. Pleasure not " +
        "guaranteed.",
      features: [
          "Vacuum-seal fit: rubber chamber adapts to anatomy on activation",
          "Electrostimulation contacts plus rhythmic scrotal compression ensure " +
          "complete spermatic evacuation as fast as physically possible.",
          "Calibrated for institutional throughput",
          "Warning: Maximum erection length for the automilker is 11 inches. For larger " +
          "erections, Over Easy recommends trimming him to fit.",
      ],
      sizeOptions: [
        { id: "sleeve-fit", label: "Sleeve fit", options: [{ value: "micro", label: "1–3\" erections (micropenis)" }, { value: "below-avg", label: "3–5\" erections (below average)" }, { value: "average", label: "5–7\" erections (average)" }, { value: "above-avg", label: "7–9\" erections (slightly above average)" }, { value: "preference", label: "9–11\" erections (standard female preference)" }, { value: "valentina", label: "VALEN-10 AGI enabled ultra-intelligent adjustable model (NOT YET SAFE FOR PUBLIC RELEASE)" }] },
      ],
    },
    {
      id: "strapon",
      category: "sex-toys",
      name: "'Selfish Bitch' Strap-On System",
      model: "OET-SB-PRO",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_strapon_device_v10.png",
      images: [
        { path: "../assets/scenes/andrea_and_lucas/overeasy_strapon_device_v10.png", caption: "Selfish Bitch™ OET-SB-PRO — dual-ended piezoreactive harness, osmium false balls" },
        { path: "../assets/scenes/andrea_and_lucas/overeasy_strapon_selfish_bitch_andrea_lucas_scared_v2.png", caption: "Andrea models the harness; Lucas knows what's coming." },
      ],
      description:
        "With its dual-ended piezoreactive automechanical architecture, this strap-on " +
        "lets you feel everything he feels when you're inside him. Osmium filled false " +
        "balls hang below to pound his sensitive manhood to mush as you rearrange his " +
        "guts, and the internal g-spot stimulator keeps you locked in and cumming " +
        "through the whole ride instead of waiting to sit on his face afterwards.",
      features: [
          "Dual-ended: external shaft plus internal g-spot stimulator for wearer " +
          "stability and pleasure",
          "Extra dense false testicles for heft and impact",
      ],
    },
    {
      id: "reactive-buttplug",
      category: "sex-toys",
      name: "'Broken Boy' Reactive Prostate Plug™",
      model: "OET-RPP-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_reactive_prostate_plug_device_v1.png",
      tagline:
        "Break him. Plug him. Make him cum the hard way.",
      description:
        "Not your normal plug. Over Easy's reactive architecture reads his resistance " +
        "and answers it — expanding, contracting, thrusting, and finding his sensitive " +
        "little love button whether he cooperates or not. The harder he tries to push " +
        "it out, the harder it pushes in. Trained for hands-free control while you " +
        "watch him squirm and leak.",
      features: [
          "Telescopic segmented shaft adapts in real time to the shape of his asshole",
          "Reactive mode doubles thrust and prostatic pressure when he resists",
          "Rhythm breaks, speeds up, and slows down to keep him guessing and leaking " +
          "semen",
      ],
    },
    {
      id: "ball-cuff",
      category: "sex-toys",
      name: "'Choking Bull' Ball Cuff™",
      model: "OET-BCF-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_ball_cuff_device_v2.png",
      tagline:
        "Streeeeeeeetch him out!",
      description:
        "Thick rubber ring made of ultra-dense silicone composite, designed to keep him " +
        "packaged up nice and tight for your pleasure.",
    },
    {
      id: "ball-anvil",
      category: "sex-toys",
      name: "Ball Anvil™",
      model: "OET-BA-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_ball_anvil_device_v1.png",
      description:
        "For the woman who wants to forge a new connection with her man and hammer home " +
        "who's in charge. Our commercial Ball Anvil™ upgrades the popular open-source " +
        "design into injection-molded black plastic with twin oval wells — sized so his " +
        "fragile lumps of ore have enough room to spread flat between your cheeks, but " +
        "are still kept in place so he can't escape the points beneath.",
    },
    {
      id: "luna-identity-arm",
      category: "discipline",
      name: "Luna™ Identity Arm",
      model: "OET-LIA-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_luna_identity_arm_scanner_mode_v2.png",
      images: [
        { path: "../assets/scenes/andrea_and_lucas/overeasy_luna_identity_arm_scanner_mode_v2.png", caption: "Non-invasive ultra-fast female identification mode" },
        { path: "../assets/scenes/andrea_and_lucas/overeasy_luna_identity_arm_audit_mode_v4.png", caption: "Thorough, secure and reliable male identification mode" },
        { path: "../assets/scenes/andrea_and_lucas/overeasy_luna_identity_arm_audit_crosssection_clinical_v3.png", caption: "Demonstration of the internal testicular cross-section after a particularly thorough identity audit. Luna's left him with just enough nutmeat intact that he'll be able to recover his fertility. Eventually." },
      ],
      tagline:
        "Safety ensured.",
      description:
        "Wall-mounted access control for spaces that cannot afford ambiguity. Luna's " +
        "built-in AI greets women with a discreet vulva scanner. Male entrants will be " +
        "audited appropriately. No matter whether Luna can tell his identity with a " +
        "single squeeze, or requires a more invasive internal testicular audit, she'll " +
        "guarantee he is who he says he is.",
      features: [
          "Articulated arm allows verification on groins of all sizes and heights",
          "Female identification mode: sub-second identity retrieval, minimally " +
          "invasive",
          "Male identification mode: six-fingered articulated grip, carbon nanofiber " +
          "auditing needle, and cauterization laser ensure a full testicular audit for " +
          "your organization's safety",
          "On-board Luna™ AI voice assistant manages credentials, clearance tiers, and " +
          "uncomfortable follow-up questions",
          "Reconfigures from vaginal scanner to testicular auditor in under two seconds",
      ],
    },
    {
      id: "garlic-press",
      category: "kitchen-gadgets",
      name: "Garlic Press",
      model: "OET-GP-1",
      image:
        "../assets/scenes/overeasy_catalog/overeasy_garlic_press_v1.png",
      description:
        "Besides pressing garlic, this handy press is great whenever you need to " +
        "extrude something in the kitchen into a uniform mush.",
    },
    {
      id: "microplane",
      category: "kitchen-gadgets",
      name: "Microplane",
      model: "OET-MP-1",
      image:
        "../assets/scenes/overeasy_catalog/overeasy_microplane_v1.png",
      description:
        "With its ultra-fine grit and carbon-steel construction, this microplane can " +
        "turn cheese, vegetables, or even meat into the finest of shavings.",
    },
    {
      id: "dual-egg-slicer",
      category: "kitchen-gadgets",
      name: "Dual Egg Slicer",
      model: "OET-DES-1",
      image:
        "../assets/scenes/overeasy_catalog/overeasy_dual_egg_slicer_v1.png",
      description:
        "Great for egg salad. Double wide design allows you to slice those eggs twice " +
        "as fast!",
    },
    {
      id: "olive-pitter",
      category: "kitchen-gadgets",
      name: "Olive Pitter",
      model: "OET-OP-1",
      image:
        "../assets/scenes/overeasy_catalog/overeasy_olive_pitter_v2.png",
      description:
        "Instantly pops the hard center out of cherries, olives, or even plums.",
    },
    {
      id: "meat-tenderizer",
      category: "kitchen-gadgets",
      name: "Meat Tenderizer",
      model: "OET-MT-1",
      image:
        "../assets/scenes/overeasy_catalog/overeasy_meat_tenderizer_v2.png",
      description:
        "A few good whacks and even stubborn meat gives way.",
    },
    {
      id: "citrus-reamer",
      category: "kitchen-gadgets",
      name: "Citrus Reamer",
      model: "OET-CR-1",
      image:
        "../assets/scenes/overeasy_catalog/overeasy_citrus_reamer_v1.png",
      description:
        "Simply half your desired fruit and use our patented reamer to extract every " +
        "last drop of juice.",
    },
    {
      id: "at-home-vasectomy-circumcision-class",
      category: "skill-training",
      name: "At-Home Vasectomy & Circumcision Skill Class",
      model: "OET-ST-VC-1",
      image:
        "../assets/scenes/overeasy_catalog/overeasy_at_home_vasectomy_circumcision_class_v1.png",
      tagline:
        "Take him off the market from your own kitchen table.",
      description:
        "Medical degrees are expensive, and a huge hassle. Doctors insist they are the " +
        "only ones who can do even the simplest of procedures, then charge an arm and a " +
        "leg for their bills.Shouldn't there be an easy way? With OverEasy's hands-on " +
        "SkillUp class, we provide you with experienced instructors and an endless " +
        "supply of practice materials so you can take control of your own home life and " +
        "learn how to disconnect his little babymakers for good.",
    },
    {
      id: "self-defense-skill-class",
      category: "skill-training",
      name: "Self Defense Skill Class",
      model: "OET-ST-SD-1",
      image:
        "../assets/scenes/overeasy_catalog/overeasy_self_defense_skill_class_v1.png",
      tagline:
        "Get your money's worth.",
      description:
        "Over Easy's certified self-defense curriculum teaches you to protect yourself " +
        "— and make every lesson count when someone needs a very direct reminder of " +
        "where he's vulnerable. Reflex drills, boundary-setting techniques, and " +
        "below-the-belt precision that leaves a permanent impression.",
      features: [
          "Twelve-week progressive video course",
          "Partner drills for knees, elbows, and targeted strikes",
          "Graduation certificate suitable for framing",
      ],
    },
    {
      id: "michelin-star-cooking-class",
      category: "skill-training",
      name: "Michelin Star Cooking Class",
      model: "OET-ST-MC-1",
      image:
        "../assets/scenes/overeasy_catalog/overeasy_michelin_star_cooking_class_v1.png",
      tagline:
        "Plate him like a professional.",
      description:
        "Elevate your kitchen game with techniques from Michelin-trained chefs — knife " +
        "skills, precise trimming, and how to reduce stubborn ingredients to their " +
        "essential parts. Perfect for the hostess who wants dinner to end with nothing " +
        "left on his plate.",
      features: [
          "Chef-led modules on filleting, deboning, and reduction",
          "Recipe cards for five-course tasting menus",
          "Branded apron and tasting spoon included",
      ],
    },
    {
      id: "male-containment-chip",
      category: "discipline",
      name: "Male Containment Chip™",
      model: "OET-MC-1",
      image:
        "../assets/scenes/andrea_and_lucas/overeasy_male_containment_chip_remote_device_v1.png",
      tagline:
        "For the corporate manager who needs to keep male and half-male employees in " +
        "line.",
      description:
        "Corporate discipline for the male employee who kept a testicle and still " +
        "cannot behave. A microchip implanted deep in the surviving gland ensures he'll " +
        "feel it around the clock, and the five graduated correction levels let you " +
        "adjust his behavior with anything from a quick reminder to a " +
        "sperm-slaughtering incineration.",
      features: [
          "Sub-dermal implant — company property, recovered on termination",
          "Manager remote: levels 1–5 disciplinary burn and scar settings",
          "Installed and uninstalled (upon employee's termination) by a certified " +
          "OverEasy technician",
          "Level 5 is reserved for serious infractions — use with moderation if " +
          "long-term disciplinary procedures are desired!",
      ],
    }
  ],
};
