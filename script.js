(function () {
  var PLACEHOLDER_COVER = "assets/covers/placeholder.svg";
  var PLACEHOLDER_CHAR = "assets/characters/placeholder.svg";

  var characters = [];
  var stories = [];

  var JINA_READER_PREFIX = "https://r.jina.ai/";
  var readerAbort = null;
  var readerStory = null;

  function byId(id) {
    return document.getElementById(id);
  }
  function qs(sel, el) {
    return (el || document).querySelector(sel);
  }
  function qsAll(sel, el) {
    return (el || document).querySelectorAll(sel);
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
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
    if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) {
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
    return (
      RELEASE_MONTH_NAMES[p.m - 1] + " " + p.d + ", " + p.y
    );
  }

  function isReleaseWithinLastThreeMonths(iso) {
    var rel = parseReleaseYyyyMmDd(iso);
    if (!rel) return false;
    var cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    var cy = cutoff.getFullYear();
    var cm = cutoff.getMonth() + 1;
    var cd = cutoff.getDate();
    return releaseYmdSortNumber(rel) >= releaseYmdSortNumber({
      y: cy,
      m: cm,
      d: cd,
    });
  }

  function shouldShowNewStoryBadge(s) {
    return (
      normalizeStoryState(s) === 2 && isReleaseWithinLastThreeMonths(s.releaseDate)
    );
  }

  function compareStories(a, b) {
    var sa = normalizeStoryState(a);
    var sb = normalizeStoryState(b);
    if (sa !== sb) return sa - sb;
    var ta = releaseDateSortKey(a);
    var tb = releaseDateSortKey(b);
    if (ta !== tb) return ta - tb;
    return (a.title || "").localeCompare(b.title || "", undefined, {
      sensitivity: "base",
    });
  }

  function getAllTags() {
    var set = {};
    stories.forEach(function (s) {
      var t = s.tags || [];
      for (var i = 0; i < t.length; i++) {
        set[t[i]] = true;
      }
    });
    return Object.keys(set).sort();
  }

  function renderStoriesGrid(selectedTag) {
    var grid = byId("stories-grid");
    if (!grid) return;
    var list = selectedTag
      ? stories.filter(function (s) {
          return (s.tags || []).indexOf(selectedTag) !== -1;
        })
      : stories.slice();
    var sorted = list.sort(compareStories);
    grid.innerHTML = "";
    sorted.forEach(function (s) {
      var card = document.createElement("article");
      card.className = "story-card";
      card.setAttribute("data-story", s.id);
      var coverContent =
        '<img src="' +
        (s.cover || PLACEHOLDER_COVER) +
        '" alt="' +
        escapeHtml(s.title) +
        '" class="story-cover" onerror="this.src=\'' +
        PLACEHOLDER_COVER +
        "'\">";
      var st = normalizeStoryState(s);
      var rowBadgeHtml = "";
      if (st === 1) {
        coverContent +=
          '<span class="story-state-badge story-state-badge--soon story-state-badge--on-cover" aria-label="Coming soon">' +
          '<span class="story-state-badge-text">Coming soon!</span>' +
          "</span>";
        rowBadgeHtml =
          '<span class="story-state-badge story-state-badge--soon story-state-badge--in-row">' +
          '<span class="story-state-badge-text">Coming soon!</span>' +
          "</span>";
      } else if (st === 2 && shouldShowNewStoryBadge(s)) {
        coverContent +=
          '<span class="story-state-badge story-state-badge--new story-state-badge--on-cover" aria-label="New story">' +
          '<span class="story-state-badge-text">New story!</span>' +
          "</span>";
        rowBadgeHtml =
          '<span class="story-state-badge story-state-badge--new story-state-badge--in-row">' +
          '<span class="story-state-badge-text">New story!</span>' +
          "</span>";
      }
      card.innerHTML =
        '<div class="story-cover-wrap">' +
        coverContent +
        "</div>" +
        '<div class="story-card-body">' +
        '<span class="story-card-title">' +
        escapeHtml(s.title) +
        "</span>" +
        rowBadgeHtml +
        "</div>";
      grid.appendChild(card);
    });
  }

  function initTagSelector() {
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
      renderStoriesGrid(select.value || null);
    });
  }

  // Hash: tabs (#stories, …), #character/<id>, #story/<id>, #story/<id>/read
  var TAB_IDS = ["stories", "characters", "about", "other-authors"];

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
    var tab = TAB_IDS.indexOf(first) !== -1 ? first : "stories";
    return { tab: tab };
  }

  function getTabFromHash() {
    return parseHash().tab;
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
    var firstPic =
      c.profilePictures && c.profilePictures[0]
        ? c.profilePictures[0]
        : PLACEHOLDER_CHAR;
    card.innerHTML =
      '<div class="character-avatar-wrap">' +
      '<img src="' +
      firstPic +
      '" alt="' +
      escapeHtml(c.name) +
      '" class="character-avatar" onerror="this.src=\'' +
      PLACEHOLDER_CHAR +
      "'\">" +
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
      section.className = "characters-section";
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

  var storyReaderEl = byId("story-reader");
  var storyReaderArticle = byId("story-reader-article");
  var storyReaderStatus = byId("story-reader-status");
  var storyReaderTitle = byId("story-reader-title");
  var storyReaderExternal = byId("story-reader-external");
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

  function extractJinaMarkdown(fullText) {
    if (!fullText || typeof fullText !== "string") return "";
    var marker = "Markdown Content:";
    var i = fullText.indexOf(marker);
    var body = i === -1 ? fullText : fullText.slice(i + marker.length);
    return body.replace(/^\r?\n+/, "").trim();
  }

  function stripGoogleDocPublishedPreamble(md) {
    if (!md || typeof md !== "string") return md;
    var lines = md.split(/\n/);
    var pubIdx = -1;
    var scanEnd = Math.min(lines.length, 40);
    var j;
    for (j = 0; j < scanEnd; j++) {
      if (lines[j].trim() === "Published using Google Docs") {
        pubIdx = j;
        break;
      }
    }
    if (pubIdx === -1) return md;
    var updIdx = -1;
    for (j = pubIdx; j < lines.length; j++) {
      if (/^Updated automatically every \d+ minutes\s*$/i.test(lines[j].trim())) {
        updIdx = j;
        break;
      }
    }
    if (updIdx === -1) return md;
    j = updIdx + 1;
    while (j < lines.length && /^\s*$/.test(lines[j])) {
      j++;
    }
    return lines.slice(j).join("\n").replace(/^\s+/, "");
  }

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
        return "[" + text + "](" + escapeHtml(decodeMarkdownUrlEntities(urlRaw).trim()) + ")";
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
      s = s.replace(
        /\*((?:\s*\S[^*\n]*?))\n+([^*\n]+?)\*(?!\*)/g,
        "*$1 $2*"
      );
      s = s.replace(/__([^_\n]+)\n+([^_]+)__/g, "__$1 $2__");
      s = s.replace(/(^|[\s(>])_([^_\n]+)\n+([^_]+)_/g, "$1_$2 $3_");
    } while (s !== prev);
    return s;
  }

  function readerInlineEmphasis(escaped) {
    var s = escaped;
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(>])_([^_\n]+)_([\s),.!?:;<]|$)/g, function (m, a, mid, c) {
      return a + "<em>" + mid + "</em>" + c;
    });
    s = s.replace(/\*((?:\s*\S[^*\n]*?))\*(?!\*)/g, "<em>$1</em>");
    return s;
  }

  function readerFormatEscapedInline(escaped) {
    var s = mergeEmphasisAcrossNewlines(escaped);
    s = linkifyEscapedMarkdown(s);
    s = readerInlineEmphasis(s);
    return s;
  }

  function storyMarkdownToSafeHtml(markdown) {
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
      if (block.indexOf("### ") === 0) {
        html.push(chapterHeading(3, block.slice(4).trim()));
      } else if (block.indexOf("## ") === 0) {
        html.push(chapterHeading(2, block.slice(3).trim()));
      } else if (block.indexOf("# ") === 0) {
        html.push(chapterHeading(3, block.slice(2).trim()));
      } else {
        var escapedPara = escapeHtml(block).replace(/\r\n/g, "\n");
        html.push(
          "<p>" +
            readerFormatEscapedInline(escapedPara).replace(/\n/g, "<br />") +
            "</p>"
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
      storyReaderScroll.removeEventListener("scroll", readerChapterScrollHandler);
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
    if (
      !storyReaderChaptersNav ||
      !storyReaderArticle ||
      !storyReaderScroll
    ) {
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
        li.className =
          "story-reader-chapters-item story-reader-chapters-item--" + level;
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
    if (!story || !story.driveUrl) return;
    if (!storyReaderArticle || !storyReaderStatus || !storyReaderError) return;
    readerStory = story;
    if (readerAbort) readerAbort.abort();
    readerAbort = new AbortController();
    teardownStoryReaderChapters();
    storyReaderError.hidden = true;
    storyReaderArticle.innerHTML = "";
    storyReaderStatus.hidden = false;
    storyReaderStatus.textContent = "Loading…";

    var jinaUrl = JINA_READER_PREFIX + story.driveUrl;
    fetch(jinaUrl, {
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
        storyReaderArticle.innerHTML = storyMarkdownToSafeHtml(
          stripGoogleDocPublishedPreamble(extractJinaMarkdown(text))
        );
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
          "Could not load the story text. Try Google Docs, or tap Try again.";
      });
  }

  function openStoryReader(story) {
    if (!story || !story.driveUrl || !storyReaderEl) return;
    flyout.setAttribute("aria-hidden", "true");
    flyout.classList.remove("open");
    document.body.classList.remove("flyout-open");

    storyReaderTitle.textContent = story.title || "";
    storyReaderExternal.href = story.driveUrl;
    storyReaderDetails.href = "#story/" + story.id;

    storyReaderEl.setAttribute("aria-hidden", "false");
    storyReaderEl.classList.add("open");
    document.body.classList.add("story-reader-open");

    loadStoryReaderContent(story);
  }

  function openStoryFlyout(story) {
    if (!story) return;
    var chars = getCharactersForStory(story);
    var charsHtml = "";
    if (chars.length) {
      charsHtml =
        '<div class="flyout-section"><h3 class="flyout-section-title">Characters</h3><ul class="flyout-list flyout-characters">';
      chars.forEach(function (c) {
        charsHtml +=
          '<li><button type="button" class="flyout-inline-link" data-character-id="' +
          escapeHtml(c.id) +
          '">' +
          escapeHtml(c.name) +
          "</button></li>";
      });
      charsHtml += "</ul></div>";
    }
    var fullStoryCtaHtml = "";
    if (story.driveUrl) {
      fullStoryCtaHtml =
        '<div class="flyout-full-story-wrap">' +
        '<a href="#story/' +
        story.id +
        '/read" class="flyout-full-story-cta">Full Story Here!</a>' +
        "</div>";
    }
    var linksHtml = '<div class="flyout-links">';
    if (story.driveUrl) {
      linksHtml +=
        '<a href="' +
        escapeHtml(story.driveUrl) +
        '" target="_blank" rel="noopener noreferrer" class="flyout-link flyout-link--secondary">Google Docs</a>';
    }
    if (story.amazonUrl) {
      linksHtml +=
        '<a href="' +
        escapeHtml(story.amazonUrl) +
        '" target="_blank" rel="noopener noreferrer" class="flyout-link">Amazon</a>';
    }
    if (story.audioUrl) {
      linksHtml +=
        '<a href="' +
        escapeHtml(story.audioUrl.replace(/ /g, "%20")) +
        '" class="flyout-link" download>Audio (m4a)</a>';
    }
    linksHtml += "</div>";

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
    var tags = story.tags && Array.isArray(story.tags) ? story.tags : [];
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
    var titleClass =
      fullStoryCtaHtml !== ""
        ? "flyout-title flyout-title--with-cta"
        : "flyout-title";
    flyoutBody.innerHTML =
      '<div class="flyout-mode flyout-mode-story">' +
      '<h2 class="' +
      titleClass +
      '">' +
      escapeHtml(story.title) +
      "</h2>" +
      fullStoryCtaHtml +
      '<p class="flyout-summary">' +
      escapeHtml(story.summary || "") +
      "</p>" +
      releaseHtml +
      subtitleHtml +
      tagsHtml +
      linksHtml +
      charsHtml +
      "</div>";

    flyout.setAttribute("aria-hidden", "false");
    flyout.classList.add("open");
    document.body.classList.add("flyout-open");

    var charButtons = flyoutBody.querySelectorAll("[data-character-id]");
    for (var i = 0; i < charButtons.length; i++) {
      charButtons[i].addEventListener("click", function () {
        var id = this.getAttribute("data-character-id");
        location.hash = "character/" + id;
      });
    }
  }

  function openCharacterFlyout(character) {
    if (!character) return;
    var charStories = getStoriesForCharacter(character.id);
    var picsHtml = "";
    var pics = character.profilePictures || [];
    if (pics.length) {
      picsHtml = '<div class="flyout-profiles">';
      pics.forEach(function (src) {
        picsHtml +=
          '<div class="flyout-profile-wrap"><img src="' +
          (src || PLACEHOLDER_CHAR) +
          '" alt="" class="flyout-profile-img" onerror="this.src=\'' +
          PLACEHOLDER_CHAR +
          "'\"></div>";
      });
      picsHtml += "</div>";
    } else {
      picsHtml =
        '<div class="flyout-profiles"><div class="flyout-profile-wrap"><img src="' +
        PLACEHOLDER_CHAR +
        '" alt="" class="flyout-profile-img"></div></div>';
    }
    var storiesHtml = "";
    if (charStories.length) {
      storiesHtml =
        '<div class="flyout-section"><h3 class="flyout-section-title">Stories</h3><ul class="flyout-list flyout-stories">';
      charStories.forEach(function (s) {
        storiesHtml +=
          '<li><button type="button" class="flyout-inline-link" data-story-id="' +
          s.id +
          '">' +
          escapeHtml(s.title) +
          "</button></li>";
      });
      storiesHtml += "</ul></div>";
    }

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
      '<div class="flyout-mode flyout-mode-character">' +
      picsHtml +
      '<h2 class="flyout-title">' +
      escapeHtml(character.name) +
      "</h2>" +
      metaHtml +
      '<p class="flyout-summary">' +
      escapeHtml(character.bio || "") +
      "</p>" +
      storiesHtml +
      "</div>";

    flyout.setAttribute("aria-hidden", "false");
    flyout.classList.add("open");
    document.body.classList.add("flyout-open");

    var storyButtons = flyoutBody.querySelectorAll("[data-story-id]");
    for (var j = 0; j < storyButtons.length; j++) {
      storyButtons[j].addEventListener("click", function () {
        var id = this.getAttribute("data-story-id");
        location.hash = "story/" + id;
      });
    }
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
    flyout.setAttribute("aria-hidden", "true");
    flyout.classList.remove("open");
    document.body.classList.remove("flyout-open");
  }

  function applyHash() {
    var state = parseHash();
    showTab(state.tab);

    if (state.readMode && state.storyId !== undefined) {
      var storyRead = getStoryById(state.storyId);
      if (storyRead && storyRead.driveUrl) {
        openStoryReader(storyRead);
      } else if (storyRead) {
        location.replace("#story/" + storyRead.id);
      } else {
        closeStoryReaderUi();
        flyout.setAttribute("aria-hidden", "true");
        flyout.classList.remove("open");
        document.body.classList.remove("flyout-open");
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
      flyout.setAttribute("aria-hidden", "true");
      flyout.classList.remove("open");
      document.body.classList.remove("flyout-open");
    }
  }

  function bindStoryGridClick() {
    var storiesGrid = byId("stories-grid");
    if (storiesGrid) {
      storiesGrid.addEventListener("click", function (e) {
        var card = e.target.closest(".story-card");
        if (!card) return;
        var id = card.getAttribute("data-story");
        location.hash = "story/" + id;
      });
    }
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
    initTagSelector();
    renderStoriesGrid();
    bindStoryGridClick();
    bindCharacterGridClick();

    if (flyoutBackdrop) flyoutBackdrop.addEventListener("click", closeFlyout);
    if (flyoutClose) flyoutClose.addEventListener("click", closeFlyout);
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
      if (e.key !== "Escape") return;
      var h = parseHash();
      if (h.readMode) {
        location.hash = "stories";
        return;
      }
      if (flyout.classList.contains("open")) closeFlyout();
    });

    window.addEventListener("hashchange", applyHash);
    applyHash();
  }

  init(window.DATA_SOURCE || { characters: [], stories: [] });
})();
