/**
 * Canonical labels and summaries for optional story content.
 * Stories mark passages with [[optional:<id>|<summary>]] … [[/optional]].
 * Multiple fetishes in one block: [[optional:id1, id2|summary]] (hide if any listed type is checked).
 *
 * Ids must match the tag exactly. Types only in manuscripts appear in
 * data/optional-content-index.js (generated at sync) and still show in Controls.
 */
window.FETISH_CONTENT_PREFS = [
  {
    id: "circumcision",
    label: "circumcision",
    summary:
      "Circumcision, post-op bandaging, or related clinic scenes.",
  },
  {
    id: "bisexual encouragement",
    label: "bisexual encouragement",
    summary:
      "Scenes where a character is teased or pushed about attraction to men.",
  },
  {
    id: "prostate massage",
    label: "prostate massage",
    summary:
      "Prostate massage, clinical milking, or related scenes.",
  },
  {
    id: "femboy castration",
    label: "femboy castration",
    summary:
      "Femboy castration, orchiectomy, or related clinical scenes.",
  },
];