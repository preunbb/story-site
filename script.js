(function () {
  var PLACEHOLDER_COVER = "assets/covers/placeholder.svg";
  var PLACEHOLDER_CHAR = "assets/characters/placeholder.svg";

  var characters = [];
  var stories = [];

  /**
   * Story bodies are pre-rendered to markdown files under assets/stories/<id>.md
   * by `npm run sync` (see scripts/sync-stories.mjs). They're committed to the
   * repo and served same-origin, so the reader needs no proxy / API key /
   * third-party service to display a story.
   */
  var STORY_MD_PREFIX = "assets/stories/";
  var readerAbort = null;
  var readerStory = null;

  function byId(id) {
    return document.getElementById(id);
  }
  function qsAll(sel, el) {
    return (el || document).querySelectorAll(sel);
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  /**
   * Build an `<img>` tag with onerror fallback to a placeholder. Centralises
   * the escaping + onerror dance shared by every cover, avatar, and scene
   * thumbnail in the UI. `extras` lets callers add e.g. ` loading="lazy"`.
   */
  function imgHtml(opts) {
    var src = opts.src || opts.placeholder;
    var extras = opts.extras ? " " + opts.extras : "";
    return (
      '<img src="' +
      escapeHtml(src) +
      '" alt="' +
      escapeHtml(opts.alt || "") +
      '" class="' +
      opts.className +
      '"' +
      extras +
      " onerror=\"this.src='" +
      opts.placeholder +
      "'\">"
    );
  }

  function getStoriesForCharacter(charId) {
    return stories.filter(function (s) {
      return s.characterIds && s.characterIds.indexOf(charId) !== -1;
    });
  }

  function getCharactersForStory(story) {
    var ids = story.characterIds || [];
    return ids
      .map(function (id) {
        return characters.filter(function (c) {
          return c.id === id;
        })[0];
      })
      .filter(Boolean);
  }

  function getCharacterById(id) {
    return characters.filter(function (c) {
      return c.id === id;
    })[0];
  }

  function getStoryById(id) {
    return stories.filter(function (s) {
      return s.id === id || Number(s.id) === Number(id);
    })[0];
  }

  function normalizeStoryState(s) {
    var st = s.state;
    if (st === 1 || st === 2 || st === 3) return st;
    if (st === "1" || st === "2" || st === "3") return parseInt(st, 10);
    return 3;
  }

  var LENGTH_TAG_PREFIX = "Length: ";

  /** Buckets from word count; returns label without the "Length: " prefix. */
  function lengthBucketLabel(wordCount) {
    if (typeof wordCount !== "number" || !isFinite(wordCount) || wordCount < 0) {
      return null;
    }
    if (wordCount < 2000) return "Extra Short";
    if (wordCount < 5000) return "Short";
    if (wordCount < 10000) return "Medium";
    if (wordCount < 20000) return "Long";
    return "Extra long";
  }

  function storyDerivedLengthTag(story) {
    if (story.fullLengthNovel) {
      return LENGTH_TAG_PREFIX + "Full Length Novel";
    }
    var label = lengthBucketLabel(story.wordCount);
    return label ? LENGTH_TAG_PREFIX + label : null;
  }

  /** Data `tags` plus auto length tag; strips any legacy stored length tags. */
  function storyEffectiveTags(story) {
    var raw = story.tags && Array.isArray(story.tags) ? story.tags.slice() : [];
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      if (String(raw[i]).indexOf(LENGTH_TAG_PREFIX) === 0) continue;
      out.push(raw[i]);
    }
    var lt = storyDerivedLengthTag(story);
    if (lt) out.push(lt);
    return out;
  }

  function storyWordCountFlyoutHtml(story) {
    if (story.fullLengthNovel) return "";
    var n = story.wordCount;
    if (typeof n !== "number" || !isFinite(n) || n < 0) return "";
    var formatted = n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return (
      '<p class="flyout-word-count">' +
      escapeHtml(formatted + " words") +
      "</p>"
    );
  }

  var RELEASE_MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  /** @returns {{ y: number, m: number, d: number } | null} */
  function parseReleaseYyyyMmDd(iso) {
    if (!iso || typeof iso !== "string") return null;
    var parts = iso.trim().split("-");
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (
      isNaN(y) ||
      isNaN(m) ||
      isNaN(d) ||
      m < 1 ||
      m > 12 ||
      d < 1 ||
      d > 31
    ) {
      return null;
    }
    return { y: y, m: m, d: d };
  }

  function releaseYmdSortNumber(ymd) {
    return ymd.y * 10000 + ymd.m * 100 + ymd.d;
  }

  function releaseDateSortKey(s) {
    var p = parseReleaseYyyyMmDd(s.releaseDate);
    if (!p) return Number.POSITIVE_INFINITY;
    return releaseYmdSortNumber(p);
  }

  /** e.g. "March 21, 2026", or null if missing/invalid */
  function formatStoryReleaseDateLabel(iso) {
    var p = parseReleaseYyyyMmDd(iso);
    if (!p) return null;
    return RELEASE_MONTH_NAMES[p.m - 1] + " " + p.d + ", " + p.y;
  }

  function isReleaseWithinLastThreeMonths(iso) {
    var rel = parseReleaseYyyyMmDd(iso);
    if (!rel) return false;
    var cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    var cy = cutoff.getFullYear();
    var cm = cutoff.getMonth() + 1;
    var cd = cutoff.getDate();
    return (
      releaseYmdSortNumber(rel) >=
      releaseYmdSortNumber({
        y: cy,
        m: cm,
        d: cd,
      })
    );
  }

  function shouldShowNewStoryBadge(s) {
    return (
      normalizeStoryState(s) === 2 &&
      isReleaseWithinLastThreeMonths(s.releaseDate)
    );
  }

  var BRUT_MAX = 5;

  function intRange(lo, hi) {
    var a = [];
    for (; lo <= hi; lo++) a.push(lo);
    return a;
  }

  function brutalityLevelOptionsHtml(levels, pick) {
    return levels
      .map(function (v) {
        return (
          '<option value="' +
          v +
          '"' +
          (v === pick ? " selected" : "") +
          ">" +
          v +
          "</option>"
        );
      })
      .join("");
  }

  /** 1–5 busted coconuts (🥥) for flyout; empty if missing/invalid */
  function formatBrutalityRatingFlyoutHtml(story) {
    var n = getStoryBrutalityRating(story);
    if (isNaN(n)) return "";
    var icons = "";
    var i;
    for (i = 0; i < n; i++) {
      icons += "\uD83E\uDD65";
    }
    return (
      '<p class="flyout-brutality"><span class="flyout-brutality-label">Brutality: </span><span class="flyout-brutality-icons" role="img" aria-label="' +
      escapeHtml("Rating " + n + " of " + BRUT_MAX) +
      '">' +
      icons +
      "</span></p>"
    );
  }

  function compareStories(a, b) {
    var sa = normalizeStoryState(a);
    var sb = normalizeStoryState(b);
    if (sa !== sb) return sa - sb;
    var ta = releaseDateSortKey(a);
    var tb = releaseDateSortKey(b);
    var aDated = isFinite(ta);
    var bDated = isFinite(tb);
    if (aDated && bDated && ta !== tb) return tb - ta;
    if (aDated !== bDated) return aDated ? -1 : 1;
    return (a.title || "").localeCompare(b.title || "", undefined, {
      sensitivity: "base",
    });
  }

  function getAllTags() {
    var set = {};
    stories.forEach(function (s) {
      var t = storyEffectiveTags(s);
      for (var i = 0; i < t.length; i++) {
        set[t[i]] = true;
      }
    });
    return Object.keys(set).sort();
  }

  function getStoryBrutalityRating(s) {
    var raw = s.brutalityRating;
    var n =
      typeof raw === "number" && !isNaN(raw) ? raw : parseInt(String(raw), 10);
    if (isNaN(n)) return NaN;
    return Math.max(1, Math.min(BRUT_MAX, n));
  }

  /** mode: "" | "eq" | "gt" | "lt" | "gte" | "lte"; level must be allowed for that mode */
  function passesBrutalityFilter(s, mode, levelStr) {
    if (!mode) return true;
    var r = getStoryBrutalityRating(s);
    if (isNaN(r)) return false;
    var n = parseInt(levelStr, 10);
    if (isNaN(n) || n < 1 || n > BRUT_MAX) return true;
    if (mode === "eq") return r === n;
    if (mode === "gt") return r > n;
    if (mode === "lt") return r < n;
    if (mode === "gte") return r >= n;
    if (mode === "lte") return r <= n;
    return true;
  }

  function storyStateBadgeHtml(kind, place) {
    var soon = kind === "soon";
    return (
      '<span class="story-state-badge story-state-badge--' +
      kind +
      " story-state-badge--" +
      place +
      '" aria-label="' +
      (soon ? "Coming soon" : "New story") +
      '"><span class="story-state-badge-text">' +
      (soon ? "Coming soon!" : "New story!") +
      "</span></span>"
    );
  }

  function storyHasPremiumTag(s) {
    var tags = s.tags || [];
    for (var i = 0; i < tags.length; i++) {
      if (String(tags[i]).indexOf("Premium") !== -1) return true;
    }
    return false;
  }

  function storyPremiumTagHtml(place) {
    return (
      '<span class="story-premium-tag story-premium-tag--' +
      place +
      '" role="img" aria-label="Premium"><span class="story-premium-tag-symbol" aria-hidden="true">$</span></span>'
    );
  }

  function storyOnCoverBadgesHtml(s) {
    var st = normalizeStoryState(s);
    var html = "";
    if (st === 1) {
      html += storyStateBadgeHtml("soon", "on-cover");
    } else if (st === 2 && shouldShowNewStoryBadge(s)) {
      html += storyStateBadgeHtml("new", "on-cover");
    }
    if (storyHasPremiumTag(s)) {
      html += storyPremiumTagHtml("on-cover");
    }
    return html;
  }

  function storyCoverImg(src, alt) {
    return imgHtml({
      src: src || PLACEHOLDER_COVER,
      alt: alt,
      className: "story-cover",
      placeholder: PLACEHOLDER_COVER,
    });
  }

  /**
   * Cover wrapper for a story card / flyout. If the story has a coverFlip
   * we build the 3D flip wrapper (front + back); otherwise just the plain
   * single-image wrapper. Either way the on-cover badges (premium / new /
   * coming-soon) are placed over the front face.
   */
  function storyCoverMarkup(s, onCoverBadges) {
    var badges = onCoverBadges || "";
    var frontImg = storyCoverImg(s.cover, s.title);
    if (!s.coverFlip) {
      return '<div class="story-cover-wrap">' + frontImg + badges + "</div>";
    }
    var flipImg = storyCoverImg(s.coverFlip, s.title + " (alternate cover)");
    return (
      '<div class="story-cover-wrap story-cover-wrap--flip" tabindex="0" role="button" aria-label="Toggle alternate cover" aria-pressed="false">' +
      '<span class="story-cover-flip-hint" aria-hidden="true">⇄</span>' +
      '<div class="story-cover-flip-inner">' +
      '<div class="story-cover-face story-cover-face--front">' +
      frontImg +
      badges +
      "</div>" +
      '<div class="story-cover-face story-cover-face--back">' +
      flipImg +
      "</div></div></div>"
    );
  }

  function toggleCoverFlip(el) {
    if (!el || !el.classList.contains("story-cover-wrap--flip")) return;
    el.classList.toggle("is-flipped");
    el.setAttribute(
      "aria-pressed",
      el.classList.contains("is-flipped") ? "true" : "false",
    );
  }

  /**
   * Handle a click event that may have hit a cover-flip element. Returns
   * true if the event was a flip toggle (and was handled / stopped); the
   * caller should bail out of any further click handling in that case.
   */
  function handleCoverFlipClick(e) {
    var flip = e.target.closest(".story-cover-wrap--flip");
    if (!flip) return false;
    e.preventDefault();
    e.stopPropagation();
    toggleCoverFlip(flip);
    return true;
  }

  function bindCoverFlipKeydown(rootEl) {
    rootEl.addEventListener("keydown", function (e) {
      var flip = e.target.closest(".story-cover-wrap--flip");
      if (
        !flip ||
        e.target !== flip ||
        (e.key !== "Enter" && e.key !== " ")
      ) {
        return;
      }
      e.preventDefault();
      toggleCoverFlip(flip);
    });
  }

  function renderStoriesGrid() {
    var grid = byId("stories-grid");
    if (!grid) return;
    var tagSelect = byId("tag-select");
    var selectedTag = tagSelect && tagSelect.value ? tagSelect.value : null;
    var modeEl = byId("brutality-mode");
    var levelEl = byId("brutality-level");
    var bMode = modeEl && modeEl.value ? modeEl.value : "";
    var bLevel = levelEl && levelEl.value ? levelEl.value : "3";

    var list = stories.filter(function (s) {
      if (selectedTag && storyEffectiveTags(s).indexOf(selectedTag) === -1) {
        return false;
      }
      if (!passesBrutalityFilter(s, bMode, bLevel)) return false;
      return true;
    });
    var sorted = list.sort(compareStories);
    grid.innerHTML = "";
    sorted.forEach(function (s) {
      var card = document.createElement("article");
      card.className = "story-card";
      card.setAttribute("data-story", s.id);
      var st = normalizeStoryState(s);
      var rowBadgeHtml = "";
      if (st === 1) {
        rowBadgeHtml = storyStateBadgeHtml("soon", "in-row");
      } else if (st === 2 && shouldShowNewStoryBadge(s)) {
        rowBadgeHtml = storyStateBadgeHtml("new", "in-row");
      }
      var rowPremiumHtml = "";
      if (storyHasPremiumTag(s)) {
        rowPremiumHtml = storyPremiumTagHtml("in-row");
      }
      var coverWrapHtml = storyCoverMarkup(s, storyOnCoverBadgesHtml(s));
      var rowTrailingInner = rowBadgeHtml + rowPremiumHtml;
      var trailingRowHtml = rowTrailingInner
        ? '<div class="story-card-trailing">' + rowTrailingInner + "</div>"
        : "";
      card.innerHTML =
        coverWrapHtml +
        '<div class="story-card-body">' +
        '<span class="story-card-title">' +
        escapeHtml(s.title) +
        "</span>" +
        trailingRowHtml +
        "</div>";
      grid.appendChild(card);
    });
  }

  function storyHasScenes(s) {
    return Array.isArray(s.scenes) && s.scenes.length > 0;
  }

  function renderScenesPanel() {
    var root = byId("scenes-list");
    if (!root) return;
    var withScenes = stories.filter(storyHasScenes).sort(function (a, b) {
      return (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
      });
    });
    root.innerHTML = "";
    if (!withScenes.length) {
      root.innerHTML =
        '<p class="scenes-intro">No illustrated scenes yet — check back soon.</p>';
      return;
    }
    withScenes.forEach(function (s) {
      var det = document.createElement("details");
      det.className = "scenes-accordion";
      det.setAttribute("data-story", String(s.id));

      var sum = document.createElement("summary");
      sum.className = "scenes-accordion-summary";

      var sceneCount = s.scenes.length;
      var countLabel = sceneCount + " scene" + (sceneCount === 1 ? "" : "s");
      sum.innerHTML =
        '<span class="scenes-accordion-chevron" aria-hidden="true"></span>' +
        imgHtml({
          src: s.cover,
          alt: "",
          className: "scenes-accordion-cover",
          placeholder: PLACEHOLDER_COVER,
          extras: 'loading="lazy"',
        }) +
        '<span class="scenes-accordion-heading">' +
        '<span class="scenes-accordion-title">' +
        escapeHtml(s.title || "Untitled") +
        "</span>" +
        '<span class="scenes-accordion-count">' +
        countLabel +
        "</span>" +
        "</span>";
      det.appendChild(sum);

      var body = document.createElement("div");
      body.className = "scenes-accordion-body";
      var sceneIndexInStory = 0;
      s.scenes.forEach(function (sc) {
        if (!sc || !sc.path) return;
        var fig = document.createElement("figure");
        fig.className = "scene-figure scene-figure--zoomable";
        fig.setAttribute("tabindex", "0");
        fig.setAttribute("title", "Click to enlarge");
        fig.setAttribute("data-story-id", String(s.id));
        fig.setAttribute("data-scene-index", String(sceneIndexInStory));
        sceneIndexInStory += 1;
        fig.innerHTML =
          '<img src="' +
          escapeHtml(sc.path) +
          '" alt="' +
          escapeHtml(sc.caption || s.title || "Scene") +
          '" class="scene-img" loading="lazy">' +
          '<figcaption class="scene-caption">' +
          escapeHtml(sc.caption || "") +
          "</figcaption>";
        body.appendChild(fig);
      });
      det.appendChild(body);

      // Keep URL in sync with the most-recently-toggled story so links to
      // /#scenes/<id> are shareable. Use replaceState so we don't re-fire
      // applyHash (which would re-scroll the user to the top of the row).
      det.addEventListener("toggle", function () {
        if (!det.isConnected) return;
        var sid = String(s.id);
        var current = parseHash();
        var newHash;
        if (det.open) {
          newHash = "#scenes/" + sid;
        } else if (
          current.tab === "scenes" &&
          current.scenesStoryId !== undefined &&
          String(current.scenesStoryId) === sid
        ) {
          newHash = "#scenes";
        } else {
          return;
        }
        if ("#" + (location.hash || "").replace(/^#/, "") === newHash) return;
        try {
          history.replaceState(null, "", newHash);
        } catch (_e) {
          location.hash = newHash;
        }
      });

      root.appendChild(det);
    });
  }

  var sceneLightbox = byId("scene-lightbox");
  var sceneLightboxPanel = byId("scene-lightbox-panel");
  var sceneLightboxImg = byId("scene-lightbox-img");
  var sceneLightboxCaption = byId("scene-lightbox-caption");
  var sceneLightboxClose = byId("scene-lightbox-close");
  var sceneLightboxPrev = byId("scene-lightbox-prev");
  var sceneLightboxNext = byId("scene-lightbox-next");
  var sceneLightboxReturnFocus = null;
  var sceneLightboxSlides = [];
  var sceneLightboxIndex = 0;

  function setSceneLightboxOpen(on) {
    if (!sceneLightbox) return;
    sceneLightbox.setAttribute("aria-hidden", on ? "false" : "true");
    sceneLightbox.classList.toggle("open", on);
    document.body.classList.toggle("scene-lightbox-open", on);
    if (!on && sceneLightboxReturnFocus && sceneLightboxReturnFocus.focus) {
      try {
        sceneLightboxReturnFocus.focus();
      } catch (_e) {}
      sceneLightboxReturnFocus = null;
    }
    if (on && sceneLightboxClose && sceneLightboxClose.focus) {
      try {
        sceneLightboxClose.focus();
      } catch (_e) {}
    }
  }

  function closeSceneLightbox() {
    sceneLightboxSlides = [];
    sceneLightboxIndex = 0;
    setSceneLightboxOpen(false);
  }

  function sceneSlidesForStory(story) {
    var out = [];
    if (!story || !Array.isArray(story.scenes)) return out;
    story.scenes.forEach(function (sc) {
      if (!sc || !sc.path) return;
      var cap = sc.caption != null ? String(sc.caption).trim() : "";
      out.push({
        path: sc.path,
        caption: cap,
        alt: sc.caption || story.title || "Scene",
      });
    });
    return out;
  }

  function updateSceneLightboxNav() {
    var n = sceneLightboxSlides.length;
    var i = sceneLightboxIndex;
    if (sceneLightboxPrev) {
      var hidePrev = n <= 1 || i <= 0;
      sceneLightboxPrev.hidden = hidePrev;
      sceneLightboxPrev.disabled = hidePrev;
    }
    if (sceneLightboxNext) {
      var hideNext = n <= 1 || i >= n - 1;
      sceneLightboxNext.hidden = hideNext;
      sceneLightboxNext.disabled = hideNext;
    }
  }

  function applySceneLightboxSlide() {
    if (!sceneLightboxImg || !sceneLightboxSlides.length) return;
    var slide = sceneLightboxSlides[sceneLightboxIndex];
    if (!slide) return;
    sceneLightboxImg.src = slide.path;
    sceneLightboxImg.alt = slide.alt || "";
    var capTrim = slide.caption;
    if (sceneLightboxPanel) {
      var n = sceneLightboxSlides.length;
      var pos = sceneLightboxIndex + 1;
      var base = capTrim || slide.alt || "Scene";
      var label =
        n > 1 ? base + " (" + pos + " of " + n + ")" : base;
      sceneLightboxPanel.setAttribute("aria-label", label);
    }
    if (sceneLightboxCaption) {
      if (capTrim) {
        sceneLightboxCaption.textContent = capTrim;
        sceneLightboxCaption.hidden = false;
      } else {
        sceneLightboxCaption.textContent = "";
        sceneLightboxCaption.hidden = true;
      }
    }
    updateSceneLightboxNav();
  }

  function sceneStepLightbox(delta) {
    var n = sceneLightboxSlides.length;
    if (n <= 1) return;
    var next = sceneLightboxIndex + delta;
    if (next < 0 || next >= n) return;
    sceneLightboxIndex = next;
    applySceneLightboxSlide();
  }

  function openSceneLightboxForStory(storyId, startIndex) {
    if (!sceneLightboxImg || !sceneLightbox) return;
    var story = getStoryById(storyId);
    var slides = sceneSlidesForStory(story);
    if (!slides.length) return;
    sceneLightboxReturnFocus = document.activeElement;
    sceneLightboxSlides = slides;
    var i =
      typeof startIndex === "number" && !isNaN(startIndex)
        ? Math.max(0, Math.min(slides.length - 1, startIndex))
        : 0;
    sceneLightboxIndex = i;
    applySceneLightboxSlide();
    setSceneLightboxOpen(true);
  }

  /**
   * Parse the `data-story-id` / `data-scene-index` pair off a zoomable
   * scene figure. Returns `null` if either is missing/invalid so the caller
   * can no-op cleanly.
   */
  function sceneFigureTarget(fig) {
    if (!fig) return null;
    var img = fig.querySelector && fig.querySelector(".scene-img");
    if (!img || !img.getAttribute("src")) return null;
    var sid = fig.getAttribute("data-story-id");
    var idxRaw = fig.getAttribute("data-scene-index");
    if (sid == null || idxRaw == null) return null;
    var idx = parseInt(idxRaw, 10);
    if (isNaN(idx)) return null;
    return { sid: sid, idx: idx };
  }

  /**
   * Wire up click + keyboard activation for `.scene-figure--zoomable` inside
   * any container. Idempotent — calling it twice on the same root is a
   * no-op. Used both for the scenes accordion (#scenes-list) and for inline
   * `[[scene:…]]` figures rendered inside the story reader article.
   */
  function bindSceneFigureZoom(root) {
    if (!root || root._sceneZoomBound) return;
    root._sceneZoomBound = true;
    root.addEventListener("click", function (e) {
      var fig =
        e.target &&
        e.target.closest &&
        e.target.closest(".scene-figure--zoomable");
      if (!fig || !root.contains(fig)) return;
      var t = sceneFigureTarget(fig);
      if (!t) return;
      openSceneLightboxForStory(t.sid, t.idx);
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var fig =
        e.target &&
        e.target.closest &&
        e.target.closest(".scene-figure--zoomable");
      if (!fig || !root.contains(fig) || fig !== e.target) return;
      var t = sceneFigureTarget(fig);
      if (!t) return;
      e.preventDefault();
      openSceneLightboxForStory(t.sid, t.idx);
    });
  }

  function initSceneLightbox() {
    if (!sceneLightbox || sceneLightbox._sceneLightboxBound) return;
    sceneLightbox._sceneLightboxBound = true;
    bindSceneFigureZoom(byId("scenes-list"));
    bindSceneFigureZoom(byId("story-reader-article"));
    sceneLightbox.addEventListener("click", closeSceneLightbox);
    if (sceneLightboxPanel) {
      sceneLightboxPanel.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }
    if (sceneLightboxClose) {
      sceneLightboxClose.addEventListener("click", function (e) {
        e.stopPropagation();
        closeSceneLightbox();
      });
    }
    if (sceneLightboxPrev) {
      sceneLightboxPrev.addEventListener("click", function (e) {
        e.stopPropagation();
        sceneStepLightbox(-1);
      });
    }
    if (sceneLightboxNext) {
      sceneLightboxNext.addEventListener("click", function (e) {
        e.stopPropagation();
        sceneStepLightbox(1);
      });
    }
  }

  function openScenesAccordionFor(storyId) {
    var root = byId("scenes-list");
    if (!root || storyId === undefined || storyId === null) return;
    var det = root.querySelector(
      '.scenes-accordion[data-story="' + String(storyId) + '"]',
    );
    if (!det) return;
    var wasOpen = det.open;
    if (!wasOpen) det.open = true;
    if (wasOpen && isElementMostlyInViewport(det)) return;
    requestAnimationFrame(function () {
      try {
        det.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (_e) {
        det.scrollIntoView();
      }
    });
  }

  function isElementMostlyInViewport(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top >= 0 && r.top < vh * 0.5;
  }

  function brutalityAllowedLevels(mode) {
    if (mode === "gt") return intRange(1, BRUT_MAX - 1);
    if (mode === "lt") return intRange(2, BRUT_MAX);
    return intRange(1, BRUT_MAX);
  }

  function defaultBrutalityPick(allowed) {
    if (allowed.indexOf(3) !== -1) return 3;
    return allowed[Math.floor((allowed.length - 1) / 2)];
  }

  function syncBrutalityLevelOptions() {
    var modeEl = byId("brutality-mode");
    var levelEl = byId("brutality-level");
    if (!modeEl || !levelEl) return;
    var mode = modeEl.value || "";
    if (!mode) {
      levelEl.disabled = true;
      levelEl.innerHTML = brutalityLevelOptionsHtml(intRange(1, BRUT_MAX), 3);
      return;
    }
    var allowed = brutalityAllowedLevels(mode);
    var prev = parseInt(levelEl.value, 10);
    var pick =
      allowed.indexOf(prev) !== -1 ? prev : defaultBrutalityPick(allowed);
    levelEl.innerHTML = brutalityLevelOptionsHtml(allowed, pick);
    levelEl.disabled = false;
  }

  function initStoryFilters() {
    var select = byId("tag-select");
    if (!select) return;
    var tags = getAllTags();
    select.innerHTML = '<option value="">All tags</option>';
    tags.forEach(function (tag) {
      var opt = document.createElement("option");
      opt.value = tag;
      opt.textContent = tag;
      select.appendChild(opt);
    });
    select.addEventListener("change", function () {
      renderStoriesGrid();
    });

    var modeEl = byId("brutality-mode");
    var levelEl = byId("brutality-level");
    if (modeEl) {
      modeEl.addEventListener("change", function () {
        syncBrutalityLevelOptions();
        renderStoriesGrid();
      });
    }
    if (levelEl) {
      levelEl.addEventListener("change", function () {
        renderStoriesGrid();
      });
    }
    syncBrutalityLevelOptions();
  }

  // Hash: tabs (#stories, …), #character/<id>, #story/<id>, #story/<id>/read,
  //       #scenes/<id> (auto-expand that story's accordion)
  var TAB_IDS = [
    "stories",
    "characters",
    "scenes",
    "about",
    "other-authors",
  ];

  function showTab(name) {
    if (TAB_IDS.indexOf(name) === -1) name = "stories";
    var panels = qsAll(".panel");
    var tabs = qsAll(".tab");
    tabs.forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === name);
    });
    panels.forEach(function (p) {
      p.classList.toggle("active", p.id === "panel-" + name);
    });
  }

  function parseHash() {
    var raw = (location.hash || "").replace(/^#/, "").toLowerCase();
    var parts = raw.split("/").filter(function (p) {
      return p.length > 0;
    });
    var first = parts[0] || "";
    if (first === "character" && parts[1]) {
      return { tab: "characters", characterId: parts[1] };
    }
    if (first === "story" && parts[1]) {
      var storyIdRaw = parts[1];
      var num = parseInt(storyIdRaw, 10);
      var sid = String(num) === storyIdRaw ? num : storyIdRaw;
      var readMode = parts[2] === "read";
      return { tab: "stories", storyId: sid, readMode: readMode };
    }
    if (first === "scenes" && parts[1]) {
      var scStoryRaw = parts[1];
      var scNum = parseInt(scStoryRaw, 10);
      var scSid = String(scNum) === scStoryRaw ? scNum : scStoryRaw;
      return { tab: "scenes", scenesStoryId: scSid };
    }
    var tab = TAB_IDS.indexOf(first) !== -1 ? first : "stories";
    return { tab: tab };
  }

  function initTabs() {
    var panels = qsAll(".panel");
    var tabs = qsAll(".tab");

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function (e) {
        e.preventDefault();
        var name = tab.getAttribute("data-tab");
        showTab(name);
        location.hash = name;
      });
    });
  }

  function renderCharacterCard(c) {
    var card = document.createElement("article");
    card.className = "character-card";
    card.setAttribute("data-character", c.id);
    var firstPic = (c.profilePictures && c.profilePictures[0]) || null;
    card.innerHTML =
      '<div class="character-avatar-wrap">' +
      imgHtml({
        src: firstPic,
        alt: c.name,
        className: "character-avatar",
        placeholder: PLACEHOLDER_CHAR,
      }) +
      "</div>" +
      '<span class="character-card-name">' +
      escapeHtml(c.name) +
      "</span>";
    return card;
  }

  // Build characters grid: female first, then male; each group sorted by name
  function initCharactersGrid() {
    var charactersGrid = byId("characters-grid");
    if (!charactersGrid || !characters.length) return;
    charactersGrid.innerHTML = "";
    var byGender = { F: [], M: [] };
    characters.forEach(function (c) {
      var g = c.gender || "M";
      if (byGender[g]) byGender[g].push(c);
    });
    ["F", "M"].forEach(function (gender) {
      var list = byGender[gender];
      if (!list.length) return;
      list.sort(function (a, b) {
        return (a.name || "").localeCompare(b.name || "", undefined, {
          sensitivity: "base",
        });
      });
      var section = document.createElement("div");
      var heading = document.createElement("h2");
      heading.className = "characters-section-title";
      heading.textContent =
        gender === "F" ? "Female characters" : "Male characters";
      section.appendChild(heading);
      var grid = document.createElement("div");
      grid.className = "characters-grid-inner";
      list.forEach(function (c) {
        grid.appendChild(renderCharacterCard(c));
      });
      section.appendChild(grid);
      charactersGrid.appendChild(section);
    });
  }

  // Flyout: one panel, two modes
  var flyout = byId("flyout");
  var flyoutBackdrop = byId("flyout-backdrop");
  var flyoutClose = byId("flyout-close");
  var flyoutBody = byId("flyout-body");
  var flyoutPanel = flyoutBody ? flyoutBody.closest(".flyout-panel") : null;

  /** Floater for Kofi-vs-Amazon hint (native `title` is often delayed or absent on touch). */
  var storyKofiPrefTipEl = null;
  var storyKofiPrefTipHideTimer = null;

  function getStoryKofiPrefTipEl() {
    if (storyKofiPrefTipEl) return storyKofiPrefTipEl;
    storyKofiPrefTipEl = document.createElement("div");
    storyKofiPrefTipEl.className = "story-kofi-pref-tooltip";
    storyKofiPrefTipEl.setAttribute("role", "tooltip");
    document.body.appendChild(storyKofiPrefTipEl);
    return storyKofiPrefTipEl;
  }

  function hideStoryKofiPrefTip() {
    if (storyKofiPrefTipHideTimer) {
      clearTimeout(storyKofiPrefTipHideTimer);
      storyKofiPrefTipHideTimer = null;
    }
    if (storyKofiPrefTipEl) storyKofiPrefTipEl.classList.remove("is-visible");
  }

  function positionStoryKofiPrefTip(anchor) {
    var tip = getStoryKofiPrefTipEl();
    var rect = anchor.getBoundingClientRect();
    var margin = 10;
    var tr = tip.getBoundingClientRect();
    var w = tr.width;
    var h = tr.height;
    var left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    var top = rect.bottom + margin;
    if (top + h > window.innerHeight - margin) {
      top = rect.top - h - margin;
    }
    if (top < margin) top = margin;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  function showStoryKofiPrefTip(anchor, text) {
    if (storyKofiPrefTipHideTimer) {
      clearTimeout(storyKofiPrefTipHideTimer);
      storyKofiPrefTipHideTimer = null;
    }
    var tip = getStoryKofiPrefTipEl();
    tip.textContent = text;
    tip.classList.add("is-visible");
    positionStoryKofiPrefTip(anchor);
    requestAnimationFrame(function () {
      positionStoryKofiPrefTip(anchor);
    });
  }

  function bindStoryKofiPrefTipUi() {
    if (!flyoutBody || flyoutBody._storyKofiPrefTipBound) return;
    flyoutBody._storyKofiPrefTipBound = true;
    flyoutBody.addEventListener("pointerover", function (e) {
      var anchor =
        e.target && e.target.closest && e.target.closest("[data-kofi-pref-tooltip]");
      if (!anchor || !flyoutBody.contains(anchor)) return;
      var msg = anchor.getAttribute("data-kofi-pref-tooltip");
      if (!msg) return;
      showStoryKofiPrefTip(anchor, msg);
    });
    flyoutBody.addEventListener("pointerout", function (e) {
      var anchor =
        e.target && e.target.closest && e.target.closest("[data-kofi-pref-tooltip]");
      if (!anchor || !flyoutBody.contains(anchor)) return;
      var rt = e.relatedTarget;
      if (rt && anchor.contains(rt)) return;
      if (document.activeElement === anchor) return;
      hideStoryKofiPrefTip();
    });
    flyoutBody.addEventListener("focusin", function (e) {
      var anchor =
        e.target && e.target.closest && e.target.closest("[data-kofi-pref-tooltip]");
      if (!anchor || !flyoutBody.contains(anchor)) return;
      var msg = anchor.getAttribute("data-kofi-pref-tooltip");
      if (!msg) return;
      showStoryKofiPrefTip(anchor, msg);
    });
    flyoutBody.addEventListener("focusout", function (e) {
      var anchor =
        e.target && e.target.closest && e.target.closest("[data-kofi-pref-tooltip]");
      if (!anchor || !flyoutBody.contains(anchor)) return;
      var rt = e.relatedTarget;
      if (rt && anchor.contains(rt)) return;
      storyKofiPrefTipHideTimer = setTimeout(function () {
        hideStoryKofiPrefTip();
      }, 0);
    });
    if (flyoutPanel) {
      flyoutPanel.addEventListener("scroll", hideStoryKofiPrefTip, { passive: true });
    }
    window.addEventListener("resize", hideStoryKofiPrefTip);
  }

  function setFlyoutPanelOpen(on) {
    flyout.setAttribute("aria-hidden", on ? "false" : "true");
    flyout.classList.toggle("open", on);
    document.body.classList.toggle("flyout-open", on);
    if (!on) hideStoryKofiPrefTip();
  }

  var storyReaderEl = byId("story-reader");
  var storyReaderArticle = byId("story-reader-article");
  var storyReaderStatus = byId("story-reader-status");
  var storyReaderTitle = byId("story-reader-title");
  var storyReaderDetails = byId("story-reader-details");
  var storyReaderError = byId("story-reader-error");
  var storyReaderErrorMsg = byId("story-reader-error-msg");
  var storyReaderRetry = byId("story-reader-retry");
  var storyReaderBack = byId("story-reader-back");
  var storyReaderScroll = byId("story-reader-scroll");
  var storyReaderChaptersNav = byId("story-reader-chapters");

  var readerChapterScrollHandler = null;
  var readerChapterHeads = [];
  var readerChapterBtns = [];

  function decodeMarkdownUrlEntities(s) {
    return s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function normalizeReaderHref(raw) {
    if (!raw || typeof raw !== "string") return null;
    var href = decodeMarkdownUrlEntities(raw).trim();
    if (!href) return null;
    var lower = href.toLowerCase();
    if (
      lower.indexOf("javascript:") === 0 ||
      lower.indexOf("data:") === 0 ||
      lower.indexOf("vbscript:") === 0
    ) {
      return null;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      if (/^https?:\/\//i.test(href)) return href;
      if (/^mailto:/i.test(href)) return href;
      return null;
    }
    if (href.indexOf("//") === 0) return "https:" + href;
    if (href.charAt(0) === "/" || href.charAt(0) === "#") return href;
    return "https://" + href;
  }

  var MD_INLINE_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;

  function linkifyEscapedMarkdown(escaped) {
    MD_INLINE_LINK.lastIndex = 0;
    return escaped.replace(MD_INLINE_LINK, function (_, text, urlRaw) {
      var href = normalizeReaderHref(urlRaw);
      if (!href) {
        return (
          "[" +
          text +
          "](" +
          escapeHtml(decodeMarkdownUrlEntities(urlRaw).trim()) +
          ")"
        );
      }
      return (
        '<a href="' +
        escapeHtml(href) +
        '" class="story-reader-inline-link" target="_blank" rel="noopener noreferrer">' +
        text +
        "</a>"
      );
    });
  }

  function mergeEmphasisAcrossNewlines(escaped) {
    var s = escaped;
    var prev;
    do {
      prev = s;
      s = s.replace(/\*\*([^*]*)\n+([^*]*)\*\*/g, "**$1 $2**");
      s = s.replace(/\*((?:\s*\S[^*\n]*?))\n+([^*\n]+?)\*(?!\*)/g, "*$1 $2*");
      s = s.replace(/__([^_\n]+)\n+([^_]+)__/g, "__$1 $2__");
      s = s.replace(/(^|[\s(>])_([^_\n]+)\n+([^_]+)_/g, "$1_$2 $3_");
    } while (s !== prev);
    return s;
  }

  function readerInlineEmphasis(escaped) {
    var s = escaped;
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(
      /(^|[\s(>])_([^_\n]+)_([\s),.!?:;<]|$)/g,
      function (m, a, mid, c) {
        return a + "<em>" + mid + "</em>" + c;
      },
    );
    s = s.replace(/\*((?:\s*\S[^*\n]*?))\*(?!\*)/g, "<em>$1</em>");
    return s;
  }

  function readerFormatEscapedInline(escaped) {
    var s = mergeEmphasisAcrossNewlines(escaped);
    s = linkifyEscapedMarkdown(s);
    s = readerInlineEmphasis(s);
    return s;
  }

  /**
   * Match an inline scene tag (`[[scene:identifier]]`) standing alone as its
   * own paragraph. Whitespace inside the brackets is permitted so users can
   * type `[[ scene : 0 ]]` and still get a hit.
   */
  var SCENE_TAG_BLOCK_RE = /^\[\[\s*scene\s*:\s*([^\]]+?)\s*\]\]$/i;

  /**
   * Resolves a `[[scene:identifier]]` identifier against `story.scenes`.
   * `identifier` is either a numeric index (0-based) or a substring of a
   * scene's `path`. Returns `{ scene, index }` on a hit, or `null` if no
   * scene matches (and the renderer should emit a visible placeholder).
   */
  function findStorySceneByIdentifier(story, identifier) {
    if (!story || !Array.isArray(story.scenes)) return null;
    var id = String(identifier == null ? "" : identifier).trim();
    if (!id) return null;
    if (/^\d+$/.test(id)) {
      var idx = parseInt(id, 10);
      var byIdx = story.scenes[idx];
      if (byIdx && byIdx.path) return { scene: byIdx, index: idx };
    }
    for (var i = 0; i < story.scenes.length; i++) {
      var sc = story.scenes[i];
      if (!sc || !sc.path) continue;
      if (sc.path === id || sc.path.indexOf(id) !== -1) {
        return { scene: sc, index: i };
      }
    }
    return null;
  }

  function readerSceneFigureHtml(story, identifier) {
    var match = findStorySceneByIdentifier(story, identifier);
    if (!match) {
      return (
        '<p class="story-reader-scene-missing">[missing scene: ' +
        escapeHtml(identifier) +
        "]</p>"
      );
    }
    var sc = match.scene;
    return (
      '<figure class="scene-figure scene-figure--zoomable story-reader-scene"' +
      ' tabindex="0" title="Click to enlarge"' +
      ' data-story-id="' +
      escapeHtml(String(story.id)) +
      '" data-scene-index="' +
      match.index +
      '">' +
      '<img src="' +
      escapeHtml(sc.path) +
      '" alt="' +
      escapeHtml(sc.caption || story.title || "Scene") +
      '" class="scene-img" loading="lazy">' +
      "</figure>"
    );
  }

  function storyMarkdownToSafeHtml(markdown, story) {
    var blocks = markdown.split(/\n\n+/);
    var html = [];
    var chapterIndex = 0;
    function chapterHeading(level, trimmed) {
      var tag = level === 2 ? "h2" : "h3";
      var inner = readerFormatEscapedInline(escapeHtml(trimmed));
      var id = "story-ch-" + chapterIndex++;
      return (
        "<" +
        tag +
        ' id="' +
        id +
        '" class="story-reader-chapter story-reader-chapter--h' +
        level +
        '">' +
        inner +
        "</" +
        tag +
        ">"
      );
    }
    var b;
    for (b = 0; b < blocks.length; b++) {
      var block = blocks[b].trim();
      if (!block) continue;
      var sceneMatch = block.match(SCENE_TAG_BLOCK_RE);
      if (sceneMatch) {
        html.push(readerSceneFigureHtml(story, sceneMatch[1]));
        continue;
      }
      if (block.indexOf("### ") === 0) {
        html.push(chapterHeading(3, block.slice(4).trim()));
      } else if (block.indexOf("## ") === 0) {
        html.push(chapterHeading(2, block.slice(3).trim()));
      } else if (block.indexOf("# ") === 0) {
        html.push(chapterHeading(3, block.slice(2).trim()));
      } else if (/^\s*(?:[-*_]\s*)+$/.test(block)) {
        html.push('<hr class="story-reader-divider" />');
      } else {
        var escapedPara = escapeHtml(block).replace(/\r\n/g, "\n");
        html.push(
          "<p>" +
            readerFormatEscapedInline(escapedPara).replace(/\n/g, "<br />") +
            "</p>",
        );
      }
    }
    return html.join("");
  }

  function elementTopInScroller(el, scroller) {
    return (
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop
    );
  }

  function updateStoryReaderChapterHighlight() {
    if (
      !storyReaderScroll ||
      !readerChapterHeads.length ||
      !readerChapterBtns.length
    ) {
      return;
    }
    var top = storyReaderScroll.scrollTop;
    var pad = 6;
    var active = 0;
    var i;
    for (i = 0; i < readerChapterHeads.length; i++) {
      var ot = elementTopInScroller(readerChapterHeads[i], storyReaderScroll);
      if (ot <= top + pad) {
        active = i;
      }
    }
    for (i = 0; i < readerChapterBtns.length; i++) {
      var on = i === active;
      readerChapterBtns[i].classList.toggle("is-active", on);
      if (on) {
        readerChapterBtns[i].setAttribute("aria-current", "location");
      } else {
        readerChapterBtns[i].removeAttribute("aria-current");
      }
    }
  }

  function teardownStoryReaderChapters() {
    if (storyReaderScroll && readerChapterScrollHandler) {
      storyReaderScroll.removeEventListener(
        "scroll",
        readerChapterScrollHandler,
      );
      readerChapterScrollHandler = null;
    }
    readerChapterHeads = [];
    readerChapterBtns = [];
    if (storyReaderChaptersNav) {
      storyReaderChaptersNav.innerHTML = "";
      storyReaderChaptersNav.hidden = true;
    }
  }

  function setupStoryReaderChapters() {
    teardownStoryReaderChapters();
    if (!storyReaderChaptersNav || !storyReaderArticle || !storyReaderScroll) {
      return;
    }
    readerChapterHeads = qsAll(".story-reader-chapter", storyReaderArticle);
    if (!readerChapterHeads.length) {
      storyReaderChaptersNav.hidden = true;
      return;
    }
    storyReaderChaptersNav.hidden = false;
    var ul = document.createElement("ul");
    ul.className = "story-reader-chapters-list";
    for (var i = 0; i < readerChapterHeads.length; i++) {
      (function (head) {
        var li = document.createElement("li");
        var level = head.classList.contains("story-reader-chapter--h2")
          ? "h2"
          : "h3";
        li.className = "story-reader-chapters-item--" + level;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "story-reader-chapters-link";
        btn.textContent = head.textContent || "";
        btn.addEventListener("click", function () {
          head.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        li.appendChild(btn);
        ul.appendChild(li);
        readerChapterBtns.push(btn);
      })(readerChapterHeads[i]);
    }
    storyReaderChaptersNav.appendChild(ul);

    var ticking = false;
    readerChapterScrollHandler = function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          updateStoryReaderChapterHighlight();
        });
      }
    };
    storyReaderScroll.addEventListener("scroll", readerChapterScrollHandler, {
      passive: true,
    });
    updateStoryReaderChapterHighlight();
  }

  function storyReaderSharePageUrl(storyId) {
    var u = new URL(location.href);
    u.hash = "story/" + storyId + "/read";
    return u.href;
  }

  var SHARE_LINK_BUILDERS = [
    {
      id: "story-reader-share-twitter",
      build: function (title, url) {
        return (
          "https://twitter.com/intent/tweet?text=" +
          encodeURIComponent(title) +
          "&url=" +
          encodeURIComponent(url)
        );
      },
    },
    {
      id: "story-reader-share-bluesky",
      build: function (title, url) {
        return (
          "https://bsky.app/intent/compose?text=" +
          encodeURIComponent(title + " " + url)
        );
      },
    },
    {
      id: "story-reader-share-reddit",
      build: function (title, url) {
        return (
          "https://www.reddit.com/submit?url=" +
          encodeURIComponent(url) +
          "&title=" +
          encodeURIComponent(title)
        );
      },
    },
  ];

  function updateStoryReaderShareLinks(story) {
    var url = storyReaderSharePageUrl(story.id);
    var title = story.title || "Story";
    SHARE_LINK_BUILDERS.forEach(function (cfg) {
      var el = byId(cfg.id);
      if (el) el.href = cfg.build(title, url);
    });
  }

  function closeStoryReaderUi() {
    teardownStoryReaderChapters();
    if (readerAbort) {
      readerAbort.abort();
      readerAbort = null;
    }
    readerStory = null;
    if (storyReaderEl) {
      storyReaderEl.setAttribute("aria-hidden", "true");
      storyReaderEl.classList.remove("open");
    }
    document.body.classList.remove("story-reader-open");
  }

  function loadStoryReaderContent(story) {
    if (!story || story.id == null) return;
    if (!storyReaderArticle || !storyReaderStatus || !storyReaderError) return;
    readerStory = story;
    if (readerAbort) readerAbort.abort();
    readerAbort = new AbortController();
    teardownStoryReaderChapters();
    storyReaderError.hidden = true;
    storyReaderArticle.innerHTML = "";
    storyReaderStatus.hidden = false;
    storyReaderStatus.textContent = "Loading…";

    var mdUrl = STORY_MD_PREFIX + story.id + ".md";
    fetch(mdUrl, {
      signal: readerAbort.signal,
      credentials: "omit",
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        if (!readerStory || readerStory.id !== story.id) return;
        storyReaderStatus.hidden = true;
        var coverHtml =
          '<div class="story-reader-cover-wrap">' +
          imgHtml({
            src: story.cover,
            alt: story.title || "Cover",
            className: "story-reader-cover-img",
            placeholder: PLACEHOLDER_COVER,
          }) +
          "</div>";
        storyReaderArticle.innerHTML =
          coverHtml + storyMarkdownToSafeHtml(text, story);
        setupStoryReaderChapters();
      })
      .catch(function (err) {
        if (err.name === "AbortError") return;
        if (!readerStory || readerStory.id !== story.id) return;
        storyReaderStatus.hidden = true;
        storyReaderArticle.innerHTML = "";
        teardownStoryReaderChapters();
        storyReaderError.hidden = false;
        storyReaderErrorMsg.textContent =
          "Could not load the story text. Tap Try again.";
      });
  }

  function flyoutInlineLinkSection(title, rows, dataAttr, getId, getText) {
    if (!rows.length) return "";
    var h =
      '<div class="flyout-section"><h3 class="flyout-section-title">' +
      title +
      '</h3><ul class="flyout-list">';
    for (var fi = 0; fi < rows.length; fi++) {
      var row = rows[fi];
      h +=
        '<li><button type="button" class="flyout-inline-link" ' +
        dataAttr +
        '="' +
        escapeHtml(String(getId(row))) +
        '">' +
        escapeHtml(getText(row) || "") +
        "</button></li>";
    }
    return h + "</ul></div>";
  }

  function openStoryReader(story) {
    if (!story || !storyReaderEl) return;
    setFlyoutPanelOpen(false);

    storyReaderTitle.textContent = story.title || "";
    storyReaderDetails.href = "#story/" + story.id;
    updateStoryReaderShareLinks(story);

    storyReaderEl.setAttribute("aria-hidden", "false");
    storyReaderEl.classList.add("open");
    document.body.classList.add("story-reader-open");

    loadStoryReaderContent(story);
  }

  var KOFI_PREFERENCE_TOOLTIP = "Kofi costs you less and pays me more!";

  function storyHasKofiOption(story) {
    if (!story) return false;
    if (story.kofiUrl) return true;
    if (story.purchaseParts && story.purchaseParts.length) {
      return story.purchaseParts.some(function (p) {
        return !!p.kofiUrl;
      });
    }
    return false;
  }

  function purchasePartCell(url, label, variant, tooltip) {
    var cls =
      "flyout-purchase-btn flyout-purchase-btn--" + escapeHtml(variant);
    var tipAttrs = tooltip
      ? ' data-kofi-pref-tooltip="' +
        escapeHtml(tooltip) +
        '" title="' +
        escapeHtml(tooltip) +
        '"'
      : "";
    if (url) {
      return (
        '<a href="' +
        escapeHtml(url) +
        '" class="' +
        cls +
        '"' +
        tipAttrs +
        ' target="_blank" rel="noopener noreferrer">' +
        escapeHtml(label) +
        "</a>"
      );
    }
    return (
      '<span class="' +
      cls +
      ' flyout-purchase-btn--disabled" aria-disabled="true"' +
      tipAttrs +
      ">" +
      escapeHtml(label) +
      "</span>"
    );
  }

  var PURCHASE_VENDORS = [
    { variant: "kofi", urlKey: "kofiUrl", label: "Kofi" },
    { variant: "amazon", urlKey: "amazonUrl", label: "Amazon" },
  ];

  function purchaseVendorGridHtml(parts, vendor) {
    var cells = parts
      .map(function (p, i) {
        var n =
          typeof p.part === "number" && !isNaN(p.part) ? p.part : i + 1;
        var tooltip =
          vendor.variant === "amazon" && p.kofiUrl
            ? KOFI_PREFERENCE_TOOLTIP
            : null;
        return purchasePartCell(
          p[vendor.urlKey],
          "Buy part " + n + " on " + vendor.label + "!",
          vendor.variant,
          tooltip,
        );
      })
      .join("");
    return '<div class="flyout-purchase-grid">' + cells + "</div>";
  }

  function formatPurchasePartsFlyoutHtml(story) {
    var parts = story.purchaseParts;
    if (!parts || !parts.length) return "";
    var grids = PURCHASE_VENDORS.map(function (v) {
      return purchaseVendorGridHtml(parts, v);
    }).join("");
    return (
      '<div class="flyout-purchase-block">' +
      '<div class="flyout-purchase-grids">' +
      grids +
      "</div></div>"
    );
  }

  /**
   * One of the green primary action buttons in the story flyout (full
   * audio download, "open reader", "buy on Amazon", etc). All three CTAs
   * share the same wrapper + class; only the href, label, and
   * download/external attributes vary.
   */
  function flyoutCtaButton(opts) {
    var href = opts.rawHref ? opts.href : escapeHtml(opts.href);
    var attrs = "";
    if (opts.download) attrs += " download";
    if (opts.external) attrs += ' target="_blank" rel="noopener noreferrer"';
    if (opts.tooltip) {
      attrs +=
        ' data-kofi-pref-tooltip="' +
        escapeHtml(opts.tooltip) +
        '" title="' +
        escapeHtml(opts.tooltip) +
        '"';
    }
    return (
      '<div class="flyout-full-story-wrap">' +
      '<a href="' +
      href +
      '" class="flyout-full-story-cta"' +
      attrs +
      ">" +
      escapeHtml(opts.label) +
      "</a></div>"
    );
  }

  function openStoryFlyout(story) {
    if (!story) return;
    var chars = getCharactersForStory(story);
    var charsHtml = flyoutInlineLinkSection(
      "Characters",
      chars,
      "data-character-id",
      function (c) {
        return c.id;
      },
      function (c) {
        return c.name;
      },
    );
    var ctaParts = [];
    if (story.audioUrl) {
      ctaParts.push(
        flyoutCtaButton({
          href: story.audioUrl.replace(/ /g, "%20"),
          label: "Full Audio Here!",
          download: true,
        }),
      );
    }
    if (normalizeStoryState(story) !== 1) {
      var readerCtaLabel;
      if (story.purchaseParts && story.purchaseParts.length) {
        readerCtaLabel = "Free Preview";
      } else if (story.audioUrl) {
        readerCtaLabel = "Full Script Here!";
      } else {
        readerCtaLabel = "Full Story Here!";
      }
      ctaParts.push(
        flyoutCtaButton({
          href: "#story/" + story.id + "/read",
          label: readerCtaLabel,
          rawHref: true,
        }),
      );
    }
    if (story.amazonUrl) {
      ctaParts.push(
        flyoutCtaButton({
          href: story.amazonUrl,
          label: "Buy on Amazon Here!",
          external: true,
          tooltip: storyHasKofiOption(story) ? KOFI_PREFERENCE_TOOLTIP : null,
        }),
      );
    }
    var purchaseHtml = "";
    if (story.purchaseParts && story.purchaseParts.length) {
      purchaseHtml = formatPurchasePartsFlyoutHtml(story);
    }
    var primaryCtaHtml = ctaParts.join("");
    var hasFlyoutCta = primaryCtaHtml !== "" || purchaseHtml !== "";

    var releaseLabel = formatStoryReleaseDateLabel(story.releaseDate);
    var releaseHtml =
      releaseLabel !== null
        ? '<p class="flyout-release-date">Release date: <em>' +
          escapeHtml(releaseLabel) +
          "</em></p>"
        : "";

    var subtitleHtml =
      story.subtitle && story.subtitle.trim()
        ? '<p class="flyout-subtitle">' +
          escapeHtml(story.subtitle.trim()) +
          "</p>"
        : "";
    var tags = storyEffectiveTags(story);
    var wordCountHtml = storyWordCountFlyoutHtml(story);
    var tagsHtml =
      tags.length > 0
        ? '<div class="flyout-tags">' +
          tags
            .map(function (tag) {
              return (
                '<span class="flyout-tag">' +
                escapeHtml(String(tag)) +
                "</span>"
              );
            })
            .join("") +
          "</div>"
        : "";
    var titleClass = hasFlyoutCta
      ? "flyout-title flyout-title--with-cta"
      : "flyout-title";
    var brutalityHtml = formatBrutalityRatingFlyoutHtml(story);
    var coverHtml;
    if (story.coverFlip) {
      coverHtml =
        '<div class="flyout-story-cover-wrap flyout-story-cover-wrap--flip">' +
        storyCoverMarkup(story, storyOnCoverBadgesHtml(story)) +
        "</div>";
    } else {
      coverHtml =
        '<div class="flyout-story-cover-wrap">' +
        imgHtml({
          src: story.cover,
          alt: story.title || "Cover",
          className: "flyout-story-cover-img",
          placeholder: PLACEHOLDER_COVER,
        }) +
        "</div>";
    }
    flyoutBody.innerHTML =
      '<div class="flyout-story">' +
      '<h2 class="' +
      titleClass +
      '">' +
      escapeHtml(story.title) +
      "</h2>" +
      coverHtml +
      (primaryCtaHtml
        ? '<div class="flyout-story-cta-mount">' + primaryCtaHtml + "</div>"
        : "") +
      purchaseHtml +
      '<div class="flyout-story-meta">' +
      '<p class="flyout-summary">' +
      escapeHtml(story.summary || "") +
      "</p>" +
      releaseHtml +
      subtitleHtml +
      wordCountHtml +
      tagsHtml +
      brutalityHtml +
      charsHtml +
      "</div></div>";

    setFlyoutPanelOpen(true);
  }

  function openCharacterFlyout(character) {
    if (!character) return;
    var charStories = getStoriesForCharacter(character.id);
    var pics = (character.profilePictures && character.profilePictures.length)
      ? character.profilePictures
      : [PLACEHOLDER_CHAR];
    var picsHtml = '<div class="flyout-profiles">' +
      pics.map(function (src) {
        return '<div class="flyout-profile-wrap">' +
          imgHtml({
            src: src,
            alt: "",
            className: "flyout-profile-img",
            placeholder: PLACEHOLDER_CHAR,
          }) +
          "</div>";
      }).join("") +
      "</div>";
    var storiesHtml = flyoutInlineLinkSection(
      "Stories",
      charStories,
      "data-story-id",
      function (s) {
        return s.id;
      },
      function (s) {
        return s.title;
      },
    );

    var genderSymbol = character.gender === "F" ? "\u2640" : "\u2642";
    var metaHtml =
      '<p class="flyout-character-meta">' + escapeHtml(genderSymbol);
    if (
      character.gender === "F" &&
      typeof character.testiclesKilled === "number"
    ) {
      metaHtml += " &middot; Testicles killed: " + character.testiclesKilled;
    }
    metaHtml += "</p>";

    flyoutBody.innerHTML =
      picsHtml +
      '<h2 class="flyout-title">' +
      escapeHtml(character.name) +
      "</h2>" +
      metaHtml +
      '<p class="flyout-summary">' +
      escapeHtml(character.bio || "") +
      "</p>" +
      storiesHtml;

    setFlyoutPanelOpen(true);
  }

  function closeFlyout() {
    var state = parseHash();
    if (state.readMode) {
      location.hash = "stories";
      return;
    }
    if (state.characterId || state.storyId !== undefined) {
      location.hash = state.tab;
      return;
    }
    setFlyoutPanelOpen(false);
  }

  function applyHash() {
    var state = parseHash();
    showTab(state.tab);

    if (state.readMode && state.storyId !== undefined) {
      var storyRead = getStoryById(state.storyId);
      if (storyRead) {
        openStoryReader(storyRead);
      } else {
        closeStoryReaderUi();
        setFlyoutPanelOpen(false);
      }
      return;
    }

    closeStoryReaderUi();

    if (state.characterId) {
      var character = getCharacterById(state.characterId);
      if (character) openCharacterFlyout(character);
      else closeFlyout();
    } else if (state.storyId !== undefined) {
      var story = getStoryById(state.storyId);
      if (story) openStoryFlyout(story);
      else closeFlyout();
    } else {
      setFlyoutPanelOpen(false);
      if (state.scenesStoryId !== undefined) {
        openScenesAccordionFor(state.scenesStoryId);
      }
    }
  }

  function bindStoryGridClick() {
    var storiesGrid = byId("stories-grid");
    if (!storiesGrid) return;
    storiesGrid.addEventListener("click", function (e) {
      if (handleCoverFlipClick(e)) return;
      var card = e.target.closest(".story-card");
      if (!card) return;
      var id = card.getAttribute("data-story");
      location.hash = "story/" + id;
    });
    bindCoverFlipKeydown(storiesGrid);
  }

  function bindCharacterGridClick() {
    var charactersGrid = byId("characters-grid");
    if (charactersGrid) {
      charactersGrid.addEventListener("click", function (e) {
        var card = e.target.closest(".character-card");
        if (!card) return;
        var id = card.getAttribute("data-character");
        location.hash = "character/" + id;
      });
    }
  }

  function renderOtherAuthors(otherAuthors) {
    var root = byId("other-authors-root");
    if (!root || !otherAuthors || !otherAuthors.length) return;
    root.innerHTML = "";
    otherAuthors.forEach(function (group) {
      var type = group.type;
      var authors = group.authors || [];
      if (!type || !authors.length) return;
      var h2 = document.createElement("h2");
      h2.className = "other-authors-subtitle";
      h2.textContent = type;
      root.appendChild(h2);
      var ul = document.createElement("ul");
      ul.className = "other-authors-list";
      authors.forEach(function (author) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = author.link || "#";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = author.name || "";
        li.appendChild(a);
        ul.appendChild(li);
      });
      root.appendChild(ul);
    });
  }

  function init(data) {
    characters = data.characters || [];
    stories = data.stories || [];

    initTabs();
    initCharactersGrid();
    renderOtherAuthors(data.otherAuthors);
    initStoryFilters();
    renderStoriesGrid();
    renderScenesPanel();
    initSceneLightbox();
    bindStoryGridClick();
    bindCharacterGridClick();

    if (flyoutBackdrop) flyoutBackdrop.addEventListener("click", closeFlyout);
    if (flyoutClose) flyoutClose.addEventListener("click", closeFlyout);
    bindStoryKofiPrefTipUi();
    if (flyoutBody) {
      flyoutBody.addEventListener("click", function (e) {
        if (handleCoverFlipClick(e)) return;
        var btn = e.target.closest(".flyout-inline-link");
        if (!btn) return;
        var cid = btn.getAttribute("data-character-id");
        if (cid) {
          location.hash = "character/" + cid;
          return;
        }
        var sid = btn.getAttribute("data-story-id");
        if (sid) location.hash = "story/" + sid;
      });
      bindCoverFlipKeydown(flyoutBody);
    }
    if (storyReaderBack) {
      storyReaderBack.addEventListener("click", function () {
        location.hash = "stories";
      });
    }
    if (storyReaderRetry) {
      storyReaderRetry.addEventListener("click", function () {
        if (readerStory) loadStoryReaderContent(readerStory);
      });
    }
    document.addEventListener("keydown", function (e) {
      var lbOpen = sceneLightbox && sceneLightbox.classList.contains("open");
      if (lbOpen && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        sceneStepLightbox(e.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (e.key !== "Escape") return;
      var h = parseHash();
      if (h.readMode) {
        location.hash = "stories";
        return;
      }
      if (lbOpen) {
        closeSceneLightbox();
        return;
      }
      if (flyout.classList.contains("open")) closeFlyout();
    });

    window.addEventListener("hashchange", applyHash);
    applyHash();
  }

  init(window.DATA_SOURCE || { characters: [], stories: [] });
})();
