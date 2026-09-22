// Character relationship graph for the Connections tab.
// Each edge: { from, to, storyId, kinds, hubPrefer? }
// kinds is required: family | relationship | knows | faction | left | right | dick | pain
// Rule: pain never coexists with left/right for the same character pair (any edge).
// hubPrefer (optional): prefer parking the other endpoint on this hub's wheel.
// Info-panel prose lives in data/infopanel.js — not here.
window.DATA_CONNECTIONS = [
  {
    from: "jenny",
    to: "sam",
    storyId: 1,
    kinds: ["left"]
  },
  {
    from: "michelle",
    to: "sam",
    storyId: 1,
    kinds: ["right"]
  },
  {
    from: "joan_white",
    to: "sam",
    storyId: 1,
    kinds: ["left", "right"]
  },
  {
    from: "cathy",
    to: "sam",
    storyId: 1,
    kinds: ["pain"]
  },
  {
    from: "amy",
    to: "sam",
    storyId: 1,
    kinds: ["pain"]
  },
  {
    from: "joan_white",
    to: "jenny",
    storyId: 1,
    kinds: ["knows"]
  },
  {
    from: "joan_white",
    to: "michelle",
    storyId: 1,
    kinds: ["knows"]
  },
  {
    from: "joan_white",
    to: "cathy",
    storyId: 1,
    kinds: ["knows"]
  },
  {
    from: "joan_white",
    to: "amy",
    storyId: 1,
    kinds: ["knows"]
  },
  {
    from: "joan_white",
    to: "monique",
    storyId: 25,
    kinds: ["knows"]
  },
  {
    from: "karen",
    to: "jeremy",
    storyId: 2,
    kinds: ["left", "right"]
  },
  {
    from: "britt",
    to: "dan",
    storyId: 5,
    kinds: ["right"]
  },
  {
    from: "sofia",
    to: "dan",
    storyId: 5,
    kinds: ["left"]
  },
  {
    from: "sofia",
    to: "venn",
    storyId: 5,
    kinds: ["left", "right"]
  },
  {
    from: "emma",
    to: "roger",
    storyId: 5,
    kinds: ["left", "right"]
  },
  {
    from: "vivian",
    to: "roger",
    storyId: 5,
    kinds: ["pain"]
  },
  {
    from: "britt",
    to: "roger",
    storyId: 5,
    kinds: ["pain"]
  },
  {
    from: "britt",
    to: "paul",
    storyId: 5,
    kinds: ["left", "right"]
  },
  {
    from: "emma",
    to: "paul",
    storyId: 5,
    kinds: ["left", "right"]
  },
  {
    from: "sofia",
    to: "paul",
    storyId: 5,
    kinds: ["left", "right"]
  },
  {
    from: "vivian",
    to: "paul",
    storyId: 5,
    kinds: ["left", "right"]
  },
  {
    from: "rachel",
    to: "greg",
    storyId: 6,
    kinds: ["left", "right"]
  },
  {
    from: "elara",
    to: "william",
    storyId: 7,
    kinds: ["left", "right"]
  },
  {
    from: "alexa",
    to: "william",
    storyId: 7,
    kinds: ["left", "right"]
  },
  {
    from: "elara",
    to: "alexa",
    storyId: 7,
    kinds: ["knows"]
  },
  {
    from: "serena",
    to: "dennis",
    storyId: 8,
    kinds: ["pain"]
  },
  {
    from: "erica",
    to: "dennis",
    storyId: 8,
    kinds: ["left", "right"]
  },
  {
    from: "serena",
    to: "erica",
    storyId: 8,
    kinds: ["knows"]
  },
  {
    from: "kayleigh",
    to: "dennis",
    storyId: 8,
    kinds: ["relationship"]
  },
  {
    from: "vivian",
    to: "david",
    storyId: 10,
    kinds: ["relationship"]
  },
  {
    from: "natalie",
    to: "david",
    storyId: 10,
    kinds: ["relationship", "left", "right"]
  },
  {
    from: "emma",
    to: "brian",
    storyId: 10,
    kinds: ["pain"]
  },
  {
    from: "melody",
    to: "richard",
    storyId: 11,
    kinds: ["left", "right"]
  },
  {
    from: "melody",
    to: "tommy",
    storyId: 11,
    kinds: ["left"]
  },
  {
    from: "melody",
    to: "nathan",
    storyId: 11,
    kinds: ["left", "right"]
  },
  {
    from: "nathan",
    to: "tommy",
    storyId: 11,
    kinds: ["knows"]
  },
  {
    from: "nathan",
    to: "richard",
    storyId: 11,
    kinds: ["knows"]
  },
  {
    from: "tommy",
    to: "richard",
    storyId: 11,
    kinds: ["knows"]
  },
  {
    from: "emma",
    to: "simon",
    storyId: 12,
    kinds: ["left", "right"]
  },
  {
    from: "jenny",
    to: "sanjay",
    storyId: 13,
    kinds: ["left", "right"]
  },
  {
    from: "cathy",
    to: "jenny",
    storyId: 13,
    kinds: ["knows"]
  },
  {
    from: "amy",
    to: "wesley",
    storyId: 14,
    kinds: ["right"]
  },
  {
    from: "amy",
    to: "wesley",
    storyId: 14,
    kinds: ["left"]
  },
  {
    from: "fiona",
    to: "brad",
    storyId: 14,
    kinds: ["left", "right"]
  },
  {
    from: "fiona",
    to: "brad",
    storyId: 14,
    kinds: ["relationship"]
  },
  {
    from: "sofia",
    to: "daniel",
    storyId: 15,
    kinds: ["left", "right"]
  },
  {
    from: "vanessa",
    to: "daniel",
    storyId: 15,
    kinds: ["pain"]
  },
  {
    from: "vanessa",
    to: "brian",
    storyId: 16,
    kinds: ["left", "right"]
  },
  {
    from: "nikita",
    to: "cole",
    storyId: 17,
    kinds: ["left", "right"]
  },
  {
    from: "poly",
    to: "robin",
    storyId: 18,
    kinds: ["knows"]
  },
  {
    from: "salei",
    to: "atheras",
    storyId: 19,
    kinds: ["left", "right"]
  },
  {
    from: "queen_mother",
    to: "atheras",
    storyId: 19,
    kinds: ["family"]
  },
  {
    from: "queen_mother",
    to: "lurian",
    storyId: 19,
    kinds: ["family"]
  },
  {
    from: "queen_mother",
    to: "vergil",
    storyId: 19,
    kinds: ["family"]
  },
  {
    from: "lurian",
    to: "atheras",
    storyId: 19,
    kinds: ["family", "pain"]
  },
  {
    from: "lurian",
    to: "vergil",
    storyId: 19,
    kinds: ["family", "pain"]
  },
  {
    from: "atheras",
    to: "vergil",
    storyId: 19,
    kinds: ["family"]
  },
  {
    from: "monique",
    to: "robert",
    storyId: 20,
    kinds: ["left", "right"]
  },
  {
    from: "melody",
    to: "robert",
    storyId: 20,
    kinds: ["family"]
  },
  {
    from: "melody",
    to: "monique",
    storyId: 20,
    kinds: ["knows"]
  },
  {
    from: "melody",
    to: "malcolm",
    storyId: 20,
    kinds: ["relationship", "left"]
  },
  {
    from: "maria",
    to: "robert",
    storyId: 20,
    kinds: ["pain"]
  },
  {
    from: "michelle",
    to: "robert",
    storyId: 20,
    kinds: ["pain"]
  },
  {
    from: "monique",
    to: "malcolm",
    storyId: 20,
    kinds: ["pain"]
  },
  {
    from: "naimi",
    to: "hato",
    storyId: 21,
    kinds: ["relationship", "pain"]
  },
  {
    from: "emma",
    to: "jose",
    storyId: 24,
    kinds: ["left", "right"]
  },
  {
    from: "alyssa",
    to: "jon",
    storyId: 25,
    kinds: ["left"]
  },
  {
    from: "michelle",
    to: "jon",
    storyId: 25,
    kinds: ["knows"]
  },
  {
    from: "alyssa",
    to: "jon",
    storyId: 25,
    kinds: ["relationship", "dick"]
  },
  {
    from: "cathy",
    to: "jon",
    storyId: 25,
    kinds: ["dick"]
  },
  {
    from: "alyssa",
    to: "jon",
    storyId: 25,
    kinds: ["right"]
  },
  {
    from: "monique",
    to: "jon",
    storyId: 25,
    kinds: ["right"]
  },
  {
    from: "cathy",
    to: "jon",
    storyId: 25,
    kinds: ["right"]
  },
  {
    from: "dr_s",
    to: "jon",
    storyId: 25,
    kinds: ["knows"]
  },
  {
    from: "melody",
    to: "eric",
    storyId: 26,
    kinds: ["left", "right"]
  },
  {
    from: "melody",
    to: "bryan",
    storyId: 26,
    kinds: ["left", "right"]
  },
  {
    from: "genovia",
    to: "sean_witches",
    storyId: 27,
    kinds: ["left", "right"]
  },
  {
    from: "sylvana",
    to: "sean_witches",
    storyId: 27,
    kinds: ["pain"]
  },
  {
    from: "kaitlin",
    to: "steven",
    storyId: 28,
    kinds: ["left", "right"]
  },
  {
    from: "june",
    to: "steven",
    storyId: 28,
    kinds: ["pain"]
  },
  {
    from: "amy",
    to: "steven",
    storyId: 28,
    kinds: ["pain"]
  },
  {
    from: "serena",
    to: "kaitlin",
    storyId: 28,
    kinds: ["knows"]
  },
  {
    from: "the_nurse",
    to: "ross",
    storyId: 29,
    kinds: ["dick"]
  },
  {
    from: "diane_postop",
    to: "james_postop",
    storyId: 30,
    kinds: ["left", "right"]
  },
  {
    from: "the_nurse",
    to: "james_postop",
    storyId: 30,
    kinds: ["left", "right"]
  },
  {
    from: "amanda_postop",
    to: "james_postop",
    storyId: 30,
    kinds: ["knows"]
  },
  {
    from: "amber_postop",
    to: "james_postop",
    storyId: 30,
    kinds: ["knows"]
  },
  {
    from: "shardene",
    to: "james_postop",
    storyId: 30,
    kinds: ["knows"]
  },
  {
    from: "officer_alice",
    to: "ivan",
    storyId: 36,
    kinds: ["left", "right", "dick"]
  },
  {
    from: "lieutenant_maria",
    to: "officer_alice",
    storyId: 36,
    kinds: ["knows"]
  },
  {
    from: "natalie",
    to: "nguyen_twins",
    storyId: 42,
    kinds: ["left", "right"]
  },
  {
    from: "brian",
    to: "natalie",
    storyId: 42,
    kinds: ["pain"]
  },
  {
    from: "andrea",
    to: "lucas",
    storyId: 43,
    kinds: ["relationship"]
  },
  {
    from: "andrea",
    to: "hunter",
    storyId: 43,
    kinds: ["left"]
  },
  {
    from: "izzie",
    to: "nate",
    storyId: 43,
    kinds: ["left", "right"]
  },
  {
    from: "bridget",
    to: "nate",
    storyId: 43,
    kinds: ["pain"]
  },
  {
    from: "andrea",
    to: "tamara",
    storyId: 43,
    kinds: ["family"]
  },
  {
    from: "andrea",
    to: "izzie",
    storyId: 43,
    kinds: ["knows"]
  },
  {
    from: "taviri",
    to: "malko",
    storyId: 44,
    kinds: ["left"]
  },
  {
    from: "melody",
    to: "ryan",
    storyId: 46,
    kinds: ["left", "right"]
  },
  {
    from: "andrea",
    to: "lucas",
    storyId: 47,
    kinds: ["relationship"]
  },
  {
    from: "andrea",
    to: "lucas",
    storyId: 47,
    kinds: ["left"]
  },
  {
    from: "andrea",
    to: "sunni",
    storyId: 47,
    kinds: ["pain"]
  },
  {
    from: "andrea",
    to: "greyson",
    storyId: 47,
    kinds: ["left"]
  },
  {
    from: "emma",
    to: "lucas",
    storyId: 47,
    kinds: ["pain"]
  },
  {
    from: "tamara",
    to: "greyson",
    storyId: 47,
    kinds: ["pain"]
  },
  {
    from: "tamara",
    to: "greyson",
    storyId: 47,
    kinds: ["pain"]
  },
  {
    from: "tamara",
    to: "yvette",
    storyId: 47,
    kinds: ["knows"]
  },
  {
    from: "eve",
    to: "broken_tree_cultists",
    storyId: 47,
    kinds: ["left"]
  },
  {
    from: "eve",
    to: "kay",
    storyId: 47,
    kinds: ["family"]
  },
  {
    from: "eve",
    to: "abby",
    storyId: 47,
    kinds: ["family"]
  },
  {
    from: "kay",
    to: "abby",
    storyId: 47,
    kinds: ["family"]
  },
  {
    from: "eve",
    to: "lucas",
    storyId: 47,
    kinds: ["family", "pain"]
  },
  {
    from: "kay",
    to: "lucas",
    storyId: 47,
    kinds: ["family", "pain"]
  },
  {
    from: "abby",
    to: "lucas",
    storyId: 47,
    kinds: ["family", "pain"]
  },
  {
    from: "kay",
    to: "isaac",
    storyId: 47,
    kinds: ["left"]
  },
  {
    from: "eve",
    to: "judah",
    storyId: 47,
    kinds: ["left"]
  },
  {
    from: "abby",
    to: "elijah",
    storyId: 47,
    kinds: ["left", "right"]
  },
  {
    from: "tamara",
    to: "judah",
    storyId: 47,
    kinds: ["left", "right"]
  },
  {
    from: "andrea",
    to: "judah",
    storyId: 47,
    kinds: ["pain"]
  },
  {
    from: "andrea",
    to: "broken_tree_cultists",
    storyId: 47,
    kinds: ["right"]
  },
  {
    from: "izzie",
    to: "broken_tree_cultists",
    storyId: 47,
    kinds: ["right"]
  },
  {
    from: "tamara",
    to: "broken_tree_cultists",
    storyId: 47,
    kinds: ["right"]
  },
  {
    from: "abby",
    to: "broken_tree_cultists",
    storyId: 47,
    kinds: ["knows"]
  },
  {
    from: "kay",
    to: "broken_tree_cultists",
    storyId: 47,
    kinds: ["knows"]
  },
  {
    from: "izzie",
    to: "lucas",
    storyId: 47,
    kinds: ["pain"]
  },
  {
    from: "cathy",
    to: "olivia",
    storyId: 48,
    kinds: ["knows"]
  },
  {
    from: "olivia",
    to: "elliot",
    storyId: 48,
    kinds: ["left", "right"]
  },
  {
    from: "olivia",
    to: "theodore",
    storyId: 48,
    kinds: ["left"]
  },
  {
    from: "olivia",
    to: "nameless_volunteers",
    storyId: 48,
    kinds: ["left"]
  },
  {
    from: "zennia",
    to: "olivia",
    storyId: 48,
    kinds: ["knows"]
  },
  {
    from: "zennia",
    to: "theodore",
    storyId: 48,
    kinds: ["left", "right"]
  },
  {
    from: "charlotte",
    to: "theodore",
    storyId: 48,
    kinds: ["relationship"]
  },
  {
    from: "olivia",
    to: "charlotte",
    storyId: 48,
    kinds: ["knows"]
  },
  {
    from: "karen",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "michelle",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "michelle",
    to: "karen",
    storyId: 49,
    kinds: ["knows"]
  },
  {
    from: "michelle",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "sofia",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "sofia",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "andrea",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "andrea",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "alyssa",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "alyssa",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "lauren",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "lauren",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "beverly",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "beverly",
    to: "stuart",
    storyId: 49,
    kinds: ["pain"]
  },
  {
    from: "beverly",
    to: "stuart",
    storyId: 49,
    kinds: ["family"]
  },
  {
    from: "lauren",
    to: "stuart",
    storyId: 49,
    kinds: ["family"]
  },
  {
    from: "yvette",
    to: "stuart",
    storyId: 49,
    kinds: ["right", "dick"]
  },
  {
    from: "tamara",
    to: "stuart",
    storyId: 49,
    kinds: ["knows"]
  },
  {
    from: "beverly",
    to: "lauren",
    storyId: 49,
    kinds: ["family"]
  },
  {
    from: "karen",
    to: "richard_stepson",
    storyId: 1,
    kinds: ["family", "left"]
  },
  {
    from: "cathy",
    to: "allan",
    storyId: 1,
    kinds: ["pain"]
  },
  {
    from: "sofia",
    to: "daniel",
    storyId: 16,
    kinds: ["left", "right"]
  },
  {
    from: "vanessa",
    to: "daniel",
    storyId: 16,
    kinds: ["relationship"]
  },
  {
    from: "alyssa",
    to: "chad",
    storyId: 25,
    kinds: ["relationship"]
  },
  {
    from: "cathy",
    to: "nameless_volunteers",
    storyId: 32,
    kinds: ["left", "right"]
  },
  {
    from: "kaitlin",
    to: "felix",
    storyId: 47,
    kinds: ["pain"]
  },
  {
    from: "yvette",
    to: "felix",
    storyId: 47,
    kinds: ["pain"]
  },
  {
    from: "tamara",
    to: "felix",
    storyId: 47,
    kinds: ["left", "right"]
  },
  {
    from: "andrea",
    to: "trinn",
    storyId: 47,
    kinds: ["right"]
  },
  {
    from: "emma",
    to: "trinn",
    storyId: 47,
    kinds: ["relationship"]
  },
  {
    from: "tamara",
    to: "trinn",
    storyId: 47,
    kinds: ["left"]
  },
  {
    from: "yvette",
    to: "sunni",
    storyId: 47,
    kinds: ["left", "right"]
  },
  {
    from: "melody",
    to: "tamara",
    storyId: 47,
    kinds: ["knows"]
  },
  {
    from: "zennia",
    to: "yvette",
    storyId: 47,
    kinds: ["family"]
  },
  {
    from: "zennia",
    to: "olivia",
    storyId: 48,
    kinds: ["knows"]
  },
  {
    from: "zennia",
    to: "cathy",
    storyId: 48,
    kinds: ["knows"]
  },
  {
    from: "zennia",
    to: "charlotte",
    storyId: 48,
    kinds: ["knows"]
  },
  {
    from: "zennia",
    to: "cherry_pop",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "andrea",
    to: "cherry_pop",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "kay",
    to: "cherry_pop",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "sunni",
    to: "cherry_pop",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "trinn",
    to: "cherry_pop",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "felix",
    to: "cherry_pop",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "greyson",
    to: "cherry_pop",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "yvette",
    to: "cherry_pop",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "zennia",
    to: "overeasy_technologies",
    storyId: 48,
    kinds: ["faction"]
  },
  {
    from: "cathy",
    to: "overeasy_technologies",
    storyId: 48,
    kinds: ["faction"]
  },
  {
    from: "olivia",
    to: "overeasy_technologies",
    storyId: 48,
    kinds: ["faction"]
  },
  {
    from: "izzie",
    to: "overeasy_technologies",
    storyId: 43,
    kinds: ["faction"]
  },
  {
    from: "charlotte",
    to: "overeasy_technologies",
    storyId: 48,
    kinds: ["faction"]
  },
  {
    from: "diane_postop",
    to: "overeasy_technologies",
    storyId: 30,
    kinds: ["faction"]
  },
  {
    from: "amanda_postop",
    to: "overeasy_technologies",
    storyId: 30,
    kinds: ["faction"]
  },
  {
    from: "amber_postop",
    to: "overeasy_technologies",
    storyId: 30,
    kinds: ["faction"]
  },
  {
    from: "elliot",
    to: "overeasy_technologies",
    storyId: 48,
    kinds: ["faction"]
  },
  {
    from: "theodore",
    to: "overeasy_technologies",
    storyId: 48,
    kinds: ["faction"]
  },
  {
    from: "nameless_volunteers",
    to: "overeasy_technologies",
    storyId: 48,
    kinds: ["faction"]
  },
  {
    from: "cherry_pop",
    to: "overeasy_technologies",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "eve",
    to: "church_broken_tree",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "kay",
    to: "church_broken_tree",
    storyId: 47,
    kinds: ["faction"],
    hubPrefer: true
  },
  {
    from: "abby",
    to: "church_broken_tree",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "isaac",
    to: "church_broken_tree",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "elijah",
    to: "church_broken_tree",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "judah",
    to: "church_broken_tree",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "broken_tree_cultists",
    to: "church_broken_tree",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "lucas",
    to: "church_broken_tree",
    storyId: 47,
    kinds: ["faction"]
  },
  {
    from: "britt",
    to: "ballbusting_arena",
    storyId: 5,
    kinds: ["faction"]
  },
  {
    from: "emma",
    to: "ballbusting_arena",
    storyId: 5,
    kinds: ["faction"]
  },
  {
    from: "vivian",
    to: "ballbusting_arena",
    storyId: 5,
    kinds: ["faction"]
  },
  {
    from: "sofia",
    to: "ballbusting_arena",
    storyId: 5,
    kinds: ["faction"]
  },
  {
    from: "dan",
    to: "ballbusting_arena",
    storyId: 5,
    kinds: ["faction"]
  },
  {
    from: "venn",
    to: "ballbusting_arena",
    storyId: 5,
    kinds: ["faction"]
  },
  {
    from: "roger",
    to: "ballbusting_arena",
    storyId: 5,
    kinds: ["faction"]
  },
  {
    from: "paul",
    to: "ballbusting_arena",
    storyId: 5,
    kinds: ["faction"]
  },
  {
    from: "vanessa",
    to: "ballbusting_arena",
    storyId: 15,
    kinds: ["faction"]
  },
  {
    from: "brian",
    to: "ballbusting_arena",
    storyId: 16,
    kinds: ["faction"]
  },
  {
    from: "daniel",
    to: "ballbusting_arena",
    storyId: 15,
    kinds: ["faction"]
  },
  {
    from: "fiona",
    to: "ballbusting_arena",
    storyId: 14,
    kinds: ["faction"]
  },
  {
    from: "brad",
    to: "ballbusting_arena",
    storyId: 14,
    kinds: ["faction"]
  },
  {
    from: "amy",
    to: "ballbusting_arena",
    storyId: 14,
    kinds: ["faction"]
  },
  {
    from: "wesley",
    to: "ballbusting_arena",
    storyId: 14,
    kinds: ["faction"]
  },
  {
    from: "natalie",
    to: "ballbusting_arena",
    storyId: 42,
    kinds: ["faction"]
  },
  {
    from: "nguyen_twins",
    to: "ballbusting_arena",
    storyId: 42,
    kinds: ["faction"]
  }
];
