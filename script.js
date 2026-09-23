(function () {
  var PLACEHOLDER_COVER = "assets/covers/placeholder.svg";
  var PLACEHOLDER_CHAR = "assets/characters/placeholder.svg";

  var characters = [];
  var stories = [];
  var captions = [];
  var captionSections = [];
  var fanart = [];
  var connections = [];
  var connectionsInfopanel = {};

  /**
   * Story bodies are pre-rendered to markdown files under assets/stories/<id>.md
   * by `npm run sync` (see scripts/sync-stories.mjs). They're committed to the
   * repo and served same-origin, so the reader needs no proxy / API key /
   * third-party service to display a story.
   */
  var STORY_MD_PREFIX = "assets/stories/";
  /** Present only after `npm run sync:andrea-complete` (dist/ is gitignored). */
  var LOCAL_DIST_MARKER_URL = "dist/andrea-and-lucas-complete/SOURCE.json";
  var LOCAL_ANDREA_STORY_MD_URL = "dist/andrea-and-lucas-complete/story.md";
  /** Catalog series labels for the stories grid filter. Order lives on each story's `series` field. */
  var STORY_SERIES = [
    {
      id: "ballbusting-arena",
      label: "The Ballbusting Arena",
    },
    {
      id: "melody-adventures",
      label: "Melody's Adventures in Testicular Violence",
    },
    {
      id: "andrea-lucas",
      label: "Andrea and Lucas",
    },
    {
      id: "no-nut-narrator",
      label: "No Nut Narrator",
    },
  ];
  var readerAbort = null;
  var readerStory = null;

  var AI_IMAGES_ENABLED_KEY = "aiImagesEnabled";

  function getAiImagesEnabled() {
    try {
      return localStorage.getItem(AI_IMAGES_ENABLED_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setAiImagesEnabled(on) {
    try {
      if (on) localStorage.setItem(AI_IMAGES_ENABLED_KEY, "1");
      else localStorage.removeItem(AI_IMAGES_ENABLED_KEY);
    } catch (e) {}
  }

  function applyAiImagesDocumentState(on) {
    document.documentElement.classList.toggle("ai-images-off", !on);
    var toggle = byId("ai-images-toggle");
    if (toggle) {
      toggle.checked = on;
      toggle.setAttribute("aria-checked", on ? "true" : "false");
    }
  }

  function refreshAiImagesDependentUi() {
    renderStoriesGrid();
    if (
      readerStory &&
      storyReaderEl &&
      storyReaderEl.classList.contains("open")
    ) {
      loadStoryReaderContent(readerStory);
    }
    if (flyout && flyout.classList.contains("open")) {
      var state = parseHash();
      if (!state.readMode && state.storyId !== undefined) {
        var story = getStoryById(state.storyId);
        if (!getAiImagesEnabled()) {
          setFlyoutPanelOpen(false);
          location.hash = "stories";
        } else if (story && isStoryVisibleInCatalog(story)) {
          openStoryFlyout(story);
        }
      }
    }
  }

  function bindAiImagesToggle() {
    var toggle = byId("ai-images-toggle");
    if (!toggle || toggle.dataset.bound) return;
    toggle.dataset.bound = "1";
    var on = getAiImagesEnabled();
    applyAiImagesDocumentState(on);
    toggle.addEventListener("change", function () {
      var enabled = !!toggle.checked;
      setAiImagesEnabled(enabled);
      applyAiImagesDocumentState(enabled);
      refreshAiImagesDependentUi();
    });
  }

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
    var onerror;
    if (opts.fallbackSrc && opts.fallbackSrc !== src) {
      onerror =
        "this.onerror=function(){this.onerror=null;this.src='" +
        opts.placeholder +
        "'};this.src='" +
        opts.fallbackSrc +
        "'";
    } else {
      onerror = "this.src='" + opts.placeholder + "'";
    }
    return (
      '<img src="' +
      escapeHtml(src) +
      '" alt="' +
      escapeHtml(opts.alt || "") +
      '" class="' +
      opts.className +
      '"' +
      extras +
      ' onerror="' +
      onerror +
      '">'
    );
  }

  function getStoriesForCharacter(charId) {
    var list = stories.filter(function (s) {
      return (
        isStoryVisibleInCatalog(s) &&
        s.characterIds &&
        s.characterIds.indexOf(charId) !== -1
      );
    });
    list.sort(compareStoriesForCharacterDisplay);
    return list;
  }

  /**
   * Prefer series.order within the same series (e.g. Arena 1–4), then catalog
   * order. Keeps Sofia's list as Arena 1–4 then Bereavement.
   */
  function compareStoriesForCharacterDisplay(a, b) {
    var aSeries = a && a.series && a.series.id;
    var bSeries = b && b.series && b.series.id;
    var aOrd =
      a && a.series && typeof a.series.order === "number"
        ? a.series.order
        : null;
    var bOrd =
      b && b.series && typeof b.series.order === "number"
        ? b.series.order
        : null;
    if (aSeries && aSeries === bSeries && aOrd != null && bOrd != null) {
      return aOrd - bOrd;
    }
    if (aSeries === "ballbusting-arena" && bSeries !== "ballbusting-arena") {
      return -1;
    }
    if (bSeries === "ballbusting-arena" && aSeries !== "ballbusting-arena") {
      return 1;
    }
    return stories.indexOf(a) - stories.indexOf(b);
  }

  function storyOrderIndexForCharacter(storyId, charId) {
    var list = getStoriesForCharacter(charId);
    var want = storyId != null ? Number(storyId) : NaN;
    var i;
    for (i = 0; i < list.length; i++) {
      if (Number(list[i].id) === want) return i;
    }
    if (storyId == null || storyId === "") return 10000;
    return 1000 + (Number(storyId) || 0);
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
    if (id == null || id === "") return undefined;
    var want = String(id).toLowerCase();
    return characters.filter(function (c) {
      return c && String(c.id).toLowerCase() === want;
    })[0];
  }

  /**
   * `profilePictures` is the canonical full-resolution list (lightbox / zoom).
   * Cast grid + connections graph use derived WebP thumbs via portraitThumbPath.
   * Accepts a legacy singular `profilePicture` string or a mistaken string
   * `profilePictures` value and normalizes to a string array.
   */
  function normalizeCharacterProfilePictures(list) {
    if (!list || !list.forEach) return;
    list.forEach(function (c) {
      if (!c) return;
      var pics = c.profilePictures;
      var legacy = c.profilePicture;
      if (typeof pics === "string") {
        pics = pics.trim() ? [pics] : [];
      } else if (!pics || !pics.slice) {
        pics = [];
      } else {
        pics = pics.slice();
      }
      if (typeof legacy === "string" && legacy.trim()) {
        if (pics.indexOf(legacy) === -1) pics.unshift(legacy);
      }
      c.profilePictures = pics.filter(function (p) {
        return p && String(p).trim();
      });
      delete c.profilePicture;
    });
  }

  /**
   * Small WebP for connections graph nodes only.
   * Cast grid, sidebar, flyout, and lightbox use full profilePictures
   * (cast grid HTML is built only after navigating to Cast).
   * Generated by: npm run thumbs
   */
  function portraitThumbPath(src) {
    if (!src || src === PLACEHOLDER_CHAR) return src;
    var s = String(src);
    if (/\.svg$/i.test(s) || /\/thumbs\//.test(s)) return s;
    var m = /^(assets\/(?:characters|brands)\/)([^/]+)\.([a-z0-9]+)$/i.exec(s);
    if (!m) return s;
    return m[1] + "thumbs/" + m[2] + ".webp";
  }

  function characterPortraitSrc(character, opts) {
    opts = opts || {};
    var pics =
      character && character.profilePictures && character.profilePictures.length
        ? character.profilePictures
        : [PLACEHOLDER_CHAR];
    var idx = typeof opts.index === "number" && opts.index >= 0 ? opts.index : 0;
    var full = pics[idx] || pics[0] || PLACEHOLDER_CHAR;
    if (opts.full) return full;
    return portraitThumbPath(full);
  }

  function getStoryById(id) {
    var gated = [
      window.DATA_ANDREA_LUCAS_FULL,
      window.DATA_BEREAVEMENT_FULL,
    ];
    for (var gi = 0; gi < gated.length; gi++) {
      var full = gated[gi];
      if (
        full &&
        full.available !== false &&
        (id === full.id || String(id) === String(full.id))
      ) {
        return full;
      }
    }
    return stories.filter(function (s) {
      return s.id === id || Number(s.id) === Number(id);
    })[0];
  }

  /** 1 = coming soon, 2 = released (default), 3 = in progress (partial / ongoing). */
  function normalizeStoryState(s) {
    var st = s.state;
    if (st === 1 || st === 2 || st === 3) return st;
    if (st === "1" || st === "2" || st === "3") return parseInt(st, 10);
    return 2;
  }

  /** Coming soon sorts first; released and in-progress share a tier (then by date). */
  function storyStateSortKey(s) {
    return normalizeStoryState(s) === 1 ? 0 : 1;
  }

  /** True when served from localhost (catalog-only; not GitHub Pages). */
  function isLocalDevHost() {
    var h = location.hostname;
    return h === "localhost" || h === "127.0.0.1";
  }

  /** Stories with `localOnly: true` are hidden on production deploys. */
  function isStoryVisibleInCatalog(story) {
    if (!story) return false;
    if (story.localOnly && !isLocalDevHost()) return false;
    return true;
  }

  /** Illustrated scenes for `state: 1` (coming soon) only show on localhost. */
  function isStoryScenesVisibleOnSite(story) {
    if (!story || story.hideScenes === true) return false;
    if (!Array.isArray(story.scenes) || story.scenes.length === 0) return false;
    if (
      normalizeStoryState(story) === 1 &&
      !isLocalDevHost() &&
      !story.scenesPublic
    ) {
      return false;
    }
    return true;
  }

  function storyHasPreviewRead(story) {
    return !!(story && story.previewRead && story.previewRead.md);
  }

  function storyPasswordProtected(story) {
    return !!(
      story &&
      story.access === "password" &&
      story.storyCiphertext &&
      story.passwordGateHash
    );
  }

  function andreaLucasFullStory() {
    return window.DATA_ANDREA_LUCAS_FULL || null;
  }

  function bereavementFullStory() {
    var full = window.DATA_BEREAVEMENT_FULL || null;
    if (!full || full.available === false) return null;
    return full;
  }

  function storyShowsAndreaLucasFullLink(story) {
    return !!(
      story &&
      story.series &&
      story.series.id === "andrea-lucas" &&
      !story.catalogHidden
    );
  }

  function storyShowsBereavementFullLink(story) {
    return !!(
      story &&
      (story.id === 49 || story.id === "49") &&
      bereavementFullStory()
    );
  }

  function storyPasswordGateDomain(story) {
    return (
      (story && story.passwordGateDomain) || "story-site:andrea-lucas:gate:"
    );
  }

  function storyPasswordKeyDomain(story) {
    return (
      (story && story.passwordKeyDomain) || "story-site:andrea-lucas:key:"
    );
  }

  function bytesToHex(bytes) {
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16);
      hex += h.length === 1 ? "0" + h : h;
    }
    return hex;
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function sha256Utf8Bytes(text) {
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest("SHA-256", data).then(function (buf) {
      return new Uint8Array(buf);
    });
  }

  function decryptPasswordStoryMarkdown(password, payload, story) {
    var keyDomain = storyPasswordKeyDomain(story);
    return sha256Utf8Bytes(keyDomain + password).then(function (keyBytes) {
      return crypto.subtle
        .importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"])
        .then(function (key) {
          var iv = base64ToBytes(payload.iv);
          var tag = base64ToBytes(payload.tag);
          var ct = base64ToBytes(payload.ciphertext);
          var combined = new Uint8Array(ct.length + tag.length);
          combined.set(ct, 0);
          combined.set(tag, ct.length);
          return crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            combined,
          );
        })
        .then(function (plainBuf) {
          return new TextDecoder("utf-8").decode(plainBuf);
        });
    });
  }

  function verifyStoryPasswordGate(password, story) {
    var gateDomain = storyPasswordGateDomain(story);
    var gateHashHex = story && story.passwordGateHash;
    return sha256Utf8Bytes(gateDomain + password).then(function (digest) {
      return bytesToHex(digest) === String(gateHashHex).toLowerCase();
    });
  }

  /** True when a markdown block is a chapter heading shown in the reader sidebar. */
  function isStoryReaderChapterHeadingBlock(block) {
    return (
      block.indexOf("### ") === 0 ||
      block.indexOf("## ") === 0 ||
      block.indexOf("# ") === 0
    );
  }

  /**
   * Keep only the first `maxChapters` sidebar chapter headings and the prose
   * under them. Used by `story.chaptersToPublish`. Prefatory content before the
   * first heading is kept. Omit / non-positive values leave markdown unchanged.
   */
  function truncateMarkdownToPublishedChapters(markdown, maxChapters) {
    if (
      typeof maxChapters !== "number" ||
      !isFinite(maxChapters) ||
      maxChapters < 1
    ) {
      return markdown;
    }
    var normalized = String(markdown || "")
      .replace(/^(\[\[\s*scene\s*:[^\]]+\]\])[ \t]*$/gim, "\n$1\n")
      .replace(/\n{3,}/g, "\n\n");
    var blocks = normalized.split(/\n\n+/);
    var out = [];
    var chapterCount = 0;
    var i;
    for (i = 0; i < blocks.length; i++) {
      var block = blocks[i].trim();
      if (!block) continue;
      if (isStoryReaderChapterHeadingBlock(block)) {
        chapterCount++;
        if (chapterCount > maxChapters) break;
      }
      out.push(block);
    }
    return out.join("\n\n");
  }

  function formatStoryReaderBuyBarHtml(story) {
    if (!story) return "";
    if (story.purchaseParts && story.purchaseParts.length) {
      var partsHtml = formatPurchasePartsFlyoutHtml(story);
      if (!partsHtml) return "";
      return (
        '<div class="story-reader-buy-bar" role="navigation" aria-label="Buy this story">' +
        partsHtml +
        "</div>"
      );
    }
    var kofiUrl = storyCatalogKofiUrl(story);
    var amazonUrl = storyCatalogAmazonUrl(story);
    if (!kofiUrl && !amazonUrl) return "";
    var links = [];
    if (kofiUrl) {
      links.push(
        storyPreviewPurchaseLink(kofiUrl, "Buy on Ko-fi", "kofi", null),
      );
    }
    if (amazonUrl) {
      links.push(
        storyPreviewPurchaseLink(
          amazonUrl,
          "Buy on Amazon",
          "amazon",
          kofiUrl ? KOFI_PREFERENCE_TOOLTIP : null,
        ),
      );
    }
    return (
      '<div class="story-reader-buy-bar" role="navigation" aria-label="Buy this story">' +
      '<div class="story-reader-buy-bar-actions">' +
      links.join("") +
      "</div></div>"
    );
  }

  function renderStoryReaderMarkdown(story, text) {
    var coverHtml = "";
    if (getAiImagesEnabled()) {
      coverHtml =
        '<div class="story-reader-cover-wrap">' +
        imgHtml({
          src: story.cover,
          alt: story.title || "Cover",
          className: "story-reader-cover-img",
          placeholder: PLACEHOLDER_COVER,
        }) +
        "</div>";
    }
    var bodyMd = truncateMarkdownToPublishedChapters(
      text,
      story && story.chaptersToPublish,
    );
    var buyBarHtml = formatStoryReaderBuyBarHtml(story);
    storyReaderArticle.innerHTML =
      coverHtml +
      buyBarHtml +
      storyMarkdownToSafeHtml(bodyMd, story) +
      formatStoryPreviewPurchaseHtml(story);
    setupStoryReaderChapters();
  }

  function storyReaderUnlockBuyNoteHtml(story) {
    if (!story) return "";
    if (story.purchaseParts && story.purchaseParts.length >= 2) {
      var part1 = null;
      var part2 = null;
      for (var i = 0; i < story.purchaseParts.length; i++) {
        var p = story.purchaseParts[i];
        if (p.part === 1) part1 = p;
        if (p.part === 2) part2 = p;
      }
      if (part1 || part2) {
        var part1Link =
          part1 && part1.kofiUrl && part1.kofiUrl.trim()
            ? '<a href="' +
              escapeHtml(part1.kofiUrl.trim()) +
              '" target="_blank" rel="noopener noreferrer">Part 1</a>'
            : "Part 1";
        var part2Link =
          part2 && part2.kofiUrl && part2.kofiUrl.trim()
            ? '<a href="' +
              escapeHtml(part2.kofiUrl.trim()) +
              '" target="_blank" rel="noopener noreferrer">Part 2</a>'
            : "Part 2";
        return (
          '<p class="story-reader-unlock-buy">Don\'t have the password yet? Purchase ' +
          part1Link +
          " and " +
          part2Link +
          ".</p>"
        );
      }
    }

    var purchasePart = storyPreviewPurchasePart(story);
    var kofiUrl =
      (purchasePart &&
        typeof purchasePart.kofiUrl === "string" &&
        purchasePart.kofiUrl.trim()) ||
      (typeof story.kofiUrl === "string" && story.kofiUrl.trim()) ||
      "";
    var amazonUrl =
      (purchasePart &&
        typeof purchasePart.amazonUrl === "string" &&
        purchasePart.amazonUrl.trim()) ||
      (typeof story.amazonUrl === "string" && story.amazonUrl.trim()) ||
      "";
    var kofiLabel =
      (purchasePart && purchasePart.kofiLabel) || "Buy on Ko-fi";
    var amazonLabel =
      (purchasePart && purchasePart.amazonLabel) || "Buy on Amazon";

    var links = [];
    if (kofiUrl) {
      links.push(
        '<a href="' +
          escapeHtml(kofiUrl) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(kofiLabel) +
          "</a>",
      );
    }
    if (amazonUrl) {
      links.push(
        '<a href="' +
          escapeHtml(amazonUrl) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(amazonLabel) +
          "</a>",
      );
    }

    if (!links.length) return "";

    return (
      '<p class="story-reader-unlock-buy">Don\'t have the password yet? ' +
      links.join(" · ") +
      "</p>"
    );
  }

  function storyReaderUnlockFormHtml(story) {
    var instructions =
      (story &&
        (story.passwordUnlockInstructions || story.passwordHint)) ||
      "Enter the password included with your purchase of this story.";
    var hint =
      story &&
      story.passwordUnlockInstructions &&
      story.passwordHint
        ? '<p class="story-reader-unlock-hint">' +
          escapeHtml(story.passwordHint) +
          "</p>"
        : "";
    return (
      '<div class="story-reader-unlock">' +
      '<h3 class="story-reader-unlock-title">Password required</h3>' +
      '<p class="story-reader-unlock-text">' +
      escapeHtml(instructions) +
      "</p>" +
      hint +
      storyReaderUnlockBuyNoteHtml(story) +
      '<form class="story-reader-unlock-form" id="story-reader-unlock-form">' +
      '<label class="story-reader-unlock-label" for="story-reader-unlock-input">Password</label>' +
      '<input class="story-reader-unlock-input" id="story-reader-unlock-input" type="password" name="password" autocomplete="current-password" required />' +
      '<button type="submit" class="story-reader-unlock-submit">Unlock</button>' +
      '<p class="story-reader-unlock-error" id="story-reader-unlock-error" hidden></p>' +
      "</form></div>"
    );
  }

  function bindStoryReaderUnlockForm(story) {
    var form = byId("story-reader-unlock-form");
    var input = byId("story-reader-unlock-input");
    var err = byId("story-reader-unlock-error");
    if (!form || !input) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var password = input.value;
      if (!password) return;
      if (err) {
        err.hidden = true;
        err.textContent = "";
      }
      var submitBtn = form.querySelector(".story-reader-unlock-submit");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Unlocking…";
      }
      verifyStoryPasswordGate(password, story)
        .then(function (ok) {
          if (!ok) throw new Error("bad-password");
          return fetch(story.storyCiphertext, {
            signal: readerAbort ? readerAbort.signal : undefined,
            credentials: "omit",
          }).then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          });
        })
        .then(function (payload) {
          return decryptPasswordStoryMarkdown(password, payload, story);
        })
        .then(function (text) {
          if (!readerStory || readerStory.id !== story.id) return;
          storyReaderStatus.hidden = true;
          renderStoryReaderMarkdown(story, text);
        })
        .catch(function (ex) {
          if (ex && ex.name === "AbortError") return;
          if (!readerStory || readerStory.id !== story.id) return;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Unlock";
          }
          if (err) {
            err.hidden = false;
            err.textContent =
              ex && ex.message === "bad-password"
                ? "Incorrect password."
                : "Could not unlock the story. Check the password and try again.";
          }
        });
    });
  }

  function isHttpUrl(url) {
    return typeof url === "string" && /^https?:\/\//i.test(url.trim());
  }

  function storyPreviewPurchasePart(story) {
    if (
      !story ||
      !Array.isArray(story.purchaseParts) ||
      !story.purchaseParts.length
    ) {
      return null;
    }
    var order =
      story.series && typeof story.series.order === "number"
        ? story.series.order
        : null;
    if (order != null) {
      for (var i = 0; i < story.purchaseParts.length; i++) {
        if (story.purchaseParts[i].part === order)
          return story.purchaseParts[i];
      }
    }
    return story.purchaseParts[story.purchaseParts.length - 1];
  }

  function storyPreviewKofiUrl(story) {
    var part = storyPreviewPurchasePart(story);
    if (!part || typeof part.kofiUrl !== "string") return null;
    var url = part.kofiUrl.trim();
    return url || null;
  }

  function storyPreviewAmazonUrl(story) {
    var part = storyPreviewPurchasePart(story);
    if (!part || typeof part.amazonUrl !== "string") return null;
    var url = part.amazonUrl.trim();
    return url || null;
  }

  function storyPreviewPurchaseLink(url, label, variant, tooltip) {
    if (!url) return "";
    var cls =
      "story-reader-preview-cta-link story-reader-preview-cta-link--" +
      escapeHtml(variant);
    var external = isHttpUrl(url)
      ? ' target="_blank" rel="noopener noreferrer"'
      : "";
    var tipAttrs = tooltip
      ? ' data-kofi-pref-tooltip="' +
        escapeHtml(tooltip) +
        '" title="' +
        escapeHtml(tooltip) +
        '"'
      : "";
    return (
      '<a class="' +
      cls +
      '" href="' +
      escapeHtml(url) +
      '"' +
      external +
      tipAttrs +
      ">" +
      escapeHtml(label) +
      "</a>"
    );
  }

  function formatStoryPreviewPurchaseHtml(story) {
    if (!storyHasPreviewRead(story)) return "";
    var kofiUrl = storyPreviewKofiUrl(story);
    var amazonUrl = storyPreviewAmazonUrl(story);
    var fullStory = andreaLucasFullStory();
    var bereavementFull = bereavementFullStory();
    var fullLink = "";
    if (fullStory && storyShowsAndreaLucasFullLink(story)) {
      fullLink = storyPreviewPurchaseLink(
        "#story/" + fullStory.id + "/read",
        "View full story (password)",
        "full",
        null,
      );
    } else if (bereavementFull && storyShowsBereavementFullLink(story)) {
      fullLink = storyPreviewPurchaseLink(
        "#story/" + bereavementFull.id + "/read",
        "View full story (password)",
        "full",
        null,
      );
    }
    if (!kofiUrl && !amazonUrl && !fullLink) return "";
    var partOrder =
      story.series && typeof story.series.order === "number"
        ? story.series.order
        : null;
    var restLabel =
      partOrder != null ? "the rest of part " + partOrder : "the rest";
    var stores = [kofiUrl ? "Ko-fi" : "", amazonUrl ? "Amazon" : ""]
      .filter(Boolean)
      .join(" and ");
    var text =
      stores
        ? "If you enjoyed this, and want to read hundreds more pages about shattered testicles, ruined reproductive abilities, and all sorts of man-destroying, woman-dominating exploits, " +
          restLabel +
          " is now available on " +
          stores +
          "!"
        : "Enjoyed the preview? Unlock the full story with your purchase password.";
    var purchasePart = storyPreviewPurchasePart(story);
    var kofiBuyLabel =
      (purchasePart && purchasePart.kofiLabel) || "Buy for $7.99 on Ko-Fi";
    var amazonBuyLabel =
      (purchasePart && purchasePart.amazonLabel) || "Buy for $9.99 on Amazon";
    var links = [
      storyPreviewPurchaseLink(kofiUrl, kofiBuyLabel, "kofi", null),
      storyPreviewPurchaseLink(amazonUrl, amazonBuyLabel, "amazon", null),
      fullLink,
    ]
      .filter(Boolean)
      .join("");
    var kofiNote =
      kofiUrl && amazonUrl
        ? '<p class="story-reader-preview-cta-note"><em>(Ko-Fi is cheaper for you and pays me more)</em></p>'
        : "";
    return (
      '<aside class="story-reader-preview-cta">' +
      '<p class="story-reader-preview-cta-text">' +
      text +
      "</p>" +
      '<div class="story-reader-preview-cta-actions">' +
      links +
      "</div>" +
      kofiNote +
      "</aside>"
    );
  }

  function storyReaderMarkdownUrl(story) {
    if (storyHasPreviewRead(story)) return story.previewRead.md;
    return STORY_MD_PREFIX + story.id + ".md";
  }

  var LENGTH_TAG_PREFIX = "Length: ";

  /** Length filter options; `value` matches `storyDerivedLengthTag` output. */
  var LENGTH_FILTER_OPTIONS = [
    {
      value: LENGTH_TAG_PREFIX + "Extra Short",
      label: LENGTH_TAG_PREFIX + "Extra Short (Less than 2000 words)",
    },
    {
      value: LENGTH_TAG_PREFIX + "Short",
      label: LENGTH_TAG_PREFIX + "Short (Less than 5000 words)",
    },
    {
      value: LENGTH_TAG_PREFIX + "Medium",
      label: LENGTH_TAG_PREFIX + "Medium (Less than 10000 words)",
    },
    {
      value: LENGTH_TAG_PREFIX + "Long",
      label: LENGTH_TAG_PREFIX + "Long (Less than 20000 words)",
    },
    {
      value: LENGTH_TAG_PREFIX + "Extra Long",
      label: LENGTH_TAG_PREFIX + "Extra Long (20000+ words)",
    },
    {
      value: LENGTH_TAG_PREFIX + "Full Length Novel",
      label: LENGTH_TAG_PREFIX + "Full Length Novel",
    },
  ];

  /** Buckets from word count; returns label without the "Length: " prefix. */
  function lengthBucketLabel(wordCount) {
    if (
      typeof wordCount !== "number" ||
      !isFinite(wordCount) ||
      wordCount < 0
    ) {
      return null;
    }
    if (wordCount < 2000) return "Extra Short";
    if (wordCount < 5000) return "Short";
    if (wordCount < 10000) return "Medium";
    if (wordCount < 20000) return "Long";
    return "Extra Long";
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
    var n = story.wordCount;
    if (typeof n !== "number" || !isFinite(n) || n < 0) return "";
    var formatted = n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return (
      '<p class="flyout-word-count">' +
      escapeHtml(formatted + " words") +
      "</p>"
    );
  }

  function formatStoryWordCountLabel(story) {
    var n = story && story.wordCount;
    if (typeof n !== "number" || !isFinite(n) || n < 0) return null;
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 }) + " words";
  }

  function storyIsReadable(story) {
    if (!story) return false;
    var st = normalizeStoryState(story);
    return st !== 1 || storyHasPreviewRead(story);
  }

  /** Hash target for cast / character-flyout story links. */
  function storyCatalogHref(story) {
    if (!story) return "#stories";
    if (storyIsReadable(story)) return "#story/" + story.id + "/read";
    return "#story/" + story.id;
  }

  function storyTextListMetaHtml(story) {
    var parts = [];
    var releaseLabel = formatStoryReleaseDateLabel(story.releaseDate);
    if (releaseLabel) parts.push(escapeHtml(releaseLabel));
    var wordLabel = formatStoryWordCountLabel(story);
    if (wordLabel) parts.push(escapeHtml(wordLabel));
    if (!parts.length) return "";
    return (
      '<p class="story-card-meta">' +
      parts.join('<span aria-hidden="true"> · </span>') +
      "</p>"
    );
  }

  function storyTextListBrutalityHtml(story) {
    var n = getStoryBrutalityRating(story);
    if (isNaN(n)) return "";
    var icons = "";
    var i;
    for (i = 0; i < n; i++) {
      icons += "\uD83E\uDD65";
    }
    return (
      '<p class="story-card-brutality">' +
      '<span class="story-card-brutality-label">Brutality: </span>' +
      '<span class="story-card-brutality-icons" role="img" aria-label="' +
      escapeHtml("Rating " + n + " of " + BRUT_MAX) +
      '">' +
      icons +
      "</span></p>"
    );
  }

  function storyTextListTagsHtml(story) {
    var tags = storyEffectiveTags(story);
    if (!tags.length) return "";
    return (
      '<div class="story-card-tags">' +
      tags
        .map(function (tag) {
          return (
            '<span class="story-card-tag">' +
            escapeHtml(String(tag)) +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function storyCatalogAmazonUrl(story) {
    if (!story) return null;
    if (typeof story.amazonUrl === "string" && story.amazonUrl.trim()) {
      return story.amazonUrl.trim();
    }
    return storyPreviewAmazonUrl(story);
  }

  function storyCatalogKofiUrl(story) {
    if (!story) return null;
    if (typeof story.kofiUrl === "string" && story.kofiUrl.trim()) {
      return story.kofiUrl.trim();
    }
    return storyPreviewKofiUrl(story);
  }

  function storyTextListActionIcon(variant) {
    if (variant === "amazon") {
      return (
        '<svg class="story-card-action-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M9.05 14.35 11.7 6.5h1.65l2.75 7.85h-1.55l-.55-1.7h-2.95l-.55 1.7H9.05zm2.4-3.05h2.15l-1.05-3.15-1.1 3.15z"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M3.6 16.55c3.05 1.75 6.45 2.65 9.95 2.65 2.25 0 4.45-.4 6.5-1.2"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="m17.55 16.15 2.55.35-.7 2.4"/>' +
        "</svg>"
      );
    }
    if (variant === "kofi") {
      return (
        '<svg class="story-card-action-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M3.25 7.25h12.5v6.35c0 2.4-1.95 4.35-4.35 4.35H7.6c-2.4 0-4.35-1.95-4.35-4.35V7.25z"/>' +
        '<path fill="currentColor" d="M15.75 8h1.85c1.85 0 3.35 1.5 3.35 3.35s-1.5 3.35-3.35 3.35h-1.85V8z"/>' +
        '<path fill="#ff5e5b" d="M9.55 9.15c-.55-.6-1.5-.6-2.05 0L7 9.65l-.5-.5c-.55-.6-1.5-.6-2.05 0-.6.65-.6 1.7 0 2.35L7 14.2l2.55-3.2c.6-.65.6-1.7 0-2.35z"/>' +
        "</svg>"
      );
    }
    return "";
  }

  function storyTextListActionButton(opts) {
    if (opts.disabled) {
      return (
        '<span class="story-card-action story-card-action--' +
        escapeHtml(opts.variant) +
        ' story-card-action--disabled" aria-disabled="true"' +
        (opts.tooltip ? ' title="' + escapeHtml(opts.tooltip) + '"' : "") +
        ">" +
        storyTextListActionIcon(opts.variant) +
        '<span class="story-card-action-label">' +
        escapeHtml(opts.label) +
        "</span></span>"
      );
    }
    var attrs =
      ' class="story-card-action story-card-action--' +
      escapeHtml(opts.variant) +
      '" href="' +
      escapeHtml(opts.href) +
      '"';
    if (opts.external) {
      attrs += ' target="_blank" rel="noopener noreferrer"';
    }
    if (opts.tooltip) {
      attrs +=
        ' data-kofi-pref-tooltip="' +
        escapeHtml(opts.tooltip) +
        '" title="' +
        escapeHtml(opts.tooltip) +
        '"';
    }
    return (
      "<a" +
      attrs +
      ">" +
      storyTextListActionIcon(opts.variant) +
      '<span class="story-card-action-label">' +
      escapeHtml(opts.label) +
      "</span></a>"
    );
  }

  function storyTextListReadLabel(story) {
    if (storyHasPreviewRead(story)) return "Read preview";
    return "Read";
  }

  /** Preview + unfinished serial: show a non-clickable "Coming soon" beside Read preview. */
  function storyShowsComingSoonAction(story) {
    return (
      !!story && storyHasPreviewRead(story) && normalizeStoryState(story) === 3
    );
  }

  function storyTextListActionsHtml(story) {
    var buttons = [];
    if (storyIsReadable(story)) {
      buttons.push(
        storyTextListActionButton({
          href: "#story/" + story.id + "/read",
          label: storyTextListReadLabel(story),
          variant: "read",
        }),
      );
    }
    if (storyShowsComingSoonAction(story)) {
      buttons.push(
        storyTextListActionButton({
          label: "Coming soon",
          variant: "soon",
          disabled: true,
          tooltip: "More chapters coming soon",
        }),
      );
    }
    if (storyShowsAndreaLucasFullLink(story)) {
      var fullStory = andreaLucasFullStory();
      if (fullStory) {
        buttons.push(
          storyTextListActionButton({
            href: "#story/" + fullStory.id + "/read",
            label: "Read full story",
            variant: "read",
          }),
        );
      }
    }
    if (storyShowsBereavementFullLink(story)) {
      var bereavementFull = bereavementFullStory();
      if (bereavementFull) {
        buttons.push(
          storyTextListActionButton({
            href: "#story/" + bereavementFull.id + "/read",
            label: "Read full story",
            variant: "read",
          }),
        );
      }
    }
    var amazonUrl = storyCatalogAmazonUrl(story);
    if (amazonUrl) {
      buttons.push(
        storyTextListActionButton({
          href: amazonUrl,
          label: "Buy on Amazon",
          variant: "amazon",
          external: true,
          tooltip: storyHasKofiOption(story) ? KOFI_PREFERENCE_TOOLTIP : null,
        }),
      );
    }
    var kofiUrl = storyCatalogKofiUrl(story);
    if (kofiUrl) {
      buttons.push(
        storyTextListActionButton({
          href: kofiUrl,
          label: "Buy on Ko-fi",
          variant: "kofi",
          external: true,
        }),
      );
    }
    if (!buttons.length) return "";
    return '<div class="story-card-actions">' + buttons.join("") + "</div>";
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

  /** ISO release date for a 1-based reader chapter index, or null. */
  function getStoryChapterReleaseIso(story, chapterOneBased) {
    if (
      !story ||
      !Array.isArray(story.chapterReleases) ||
      typeof chapterOneBased !== "number" ||
      !isFinite(chapterOneBased) ||
      chapterOneBased < 1
    ) {
      return null;
    }
    var n = Math.floor(chapterOneBased);
    for (var i = 0; i < story.chapterReleases.length; i++) {
      var entry = story.chapterReleases[i];
      if (
        entry &&
        entry.chapter === n &&
        typeof entry.releaseDate === "string"
      ) {
        return entry.releaseDate.trim() || null;
      }
    }
    return null;
  }

  function formatStoryChapterReleaseDateLabel(story, chapterOneBased) {
    return formatStoryReleaseDateLabel(
      getStoryChapterReleaseIso(story, chapterOneBased),
    );
  }

  /** Latest releaseDate among published chapters (respects chaptersToPublish). */
  function getLatestPublishedChapterReleaseIso(story) {
    if (!story || !Array.isArray(story.chapterReleases)) return null;
    var maxChapter =
      typeof story.chaptersToPublish === "number" &&
      isFinite(story.chaptersToPublish)
        ? Math.floor(story.chaptersToPublish)
        : Number.POSITIVE_INFINITY;
    var latestIso = null;
    var latestKey = -1;
    for (var i = 0; i < story.chapterReleases.length; i++) {
      var entry = story.chapterReleases[i];
      if (
        !entry ||
        typeof entry.chapter !== "number" ||
        entry.chapter < 1 ||
        entry.chapter > maxChapter
      ) {
        continue;
      }
      var p = parseReleaseYyyyMmDd(entry.releaseDate);
      if (!p) continue;
      var key = releaseYmdSortNumber(p);
      if (key > latestKey) {
        latestKey = key;
        latestIso = entry.releaseDate.trim();
      }
    }
    return latestIso;
  }

  function formatStoryChapterReleasesFlyoutHtml(story) {
    if (
      !story ||
      !Array.isArray(story.chapterReleases) ||
      !story.chapterReleases.length
    ) {
      return "";
    }
    var sorted = story.chapterReleases.slice().sort(function (a, b) {
      return (a.chapter || 0) - (b.chapter || 0);
    });
    var items = "";
    for (var i = 0; i < sorted.length; i++) {
      var entry = sorted[i];
      if (!entry || typeof entry.chapter !== "number") continue;
      var dateLabel = formatStoryReleaseDateLabel(entry.releaseDate);
      if (!dateLabel) continue;
      var title =
        entry.title && String(entry.title).trim()
          ? String(entry.title).trim()
          : "Chapter " + entry.chapter;
      items +=
        '<li class="flyout-chapter-release-item">' +
        '<span class="flyout-chapter-release-title">' +
        escapeHtml(title) +
        "</span> " +
        '<em class="flyout-chapter-release-date">' +
        escapeHtml(dateLabel) +
        "</em></li>";
    }
    if (!items) return "";
    return (
      '<div class="flyout-chapter-releases">' +
      '<h3 class="flyout-chapter-releases-heading">Chapter releases</h3>' +
      '<ul class="flyout-chapter-releases-list">' +
      items +
      "</ul></div>"
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
    return (
      releaseYmdSortNumber(rel) >=
      releaseYmdSortNumber({
        y: cy,
        m: cm,
        d: cd,
      })
    );
  }

  /** Released stories with a recent releaseDate show the green "New story!" badge. */
  function shouldShowNewStoryBadge(s) {
    return (
      normalizeStoryState(s) === 2 &&
      isReleaseWithinLastThreeMonths(s.releaseDate)
    );
  }

  var BRUT_MAX = 6;

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

  /** 1–6 busted coconuts (🥥) for flyout; empty if missing/invalid */
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
    var sa = storyStateSortKey(a);
    var sb = storyStateSortKey(b);
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
        if (String(t[i]).indexOf("Series:") === 0) continue;
        if (String(t[i]).indexOf(LENGTH_TAG_PREFIX) === 0) continue;
        set[t[i]] = true;
      }
    });
    return Object.keys(set).sort();
  }

  function storySeriesId(story) {
    return story.series && story.series.id ? story.series.id : null;
  }

  function storySeriesOrder(story) {
    if (!story.series || typeof story.series.order !== "number")
      return Infinity;
    return story.series.order;
  }

  function findStorySeries(seriesId) {
    if (!seriesId) return null;
    for (var i = 0; i < STORY_SERIES.length; i++) {
      if (STORY_SERIES[i].id === seriesId) return STORY_SERIES[i];
    }
    return null;
  }

  function storyInSeries(story, series) {
    if (!series) return true;
    return storySeriesId(story) === series.id;
  }

  function compareStoriesForFilter(a, b, series) {
    if (series) {
      var ia = storySeriesOrder(a);
      var ib = storySeriesOrder(b);
      if (ia !== ib) return ia - ib;
    }
    return compareStories(a, b);
  }

  function passesLengthFilter(story, selectedLengthTag) {
    if (!selectedLengthTag) return true;
    return storyDerivedLengthTag(story) === selectedLengthTag;
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

  function storyStateBadgeHtml(kind, place, story) {
    var label;
    var text;
    if (kind === "soon") {
      label = "Coming soon";
      text = "Coming soon!";
    } else if (kind === "in-progress") {
      label = "In progress";
      text = "In progress!";
      var lastChapterLabel =
        story &&
        formatStoryReleaseDateLabel(getLatestPublishedChapterReleaseIso(story));
      if (lastChapterLabel) {
        text += " Last chapter released: " + lastChapterLabel;
        label += ". Last chapter released: " + lastChapterLabel;
      }
    } else {
      label = "New story";
      text = "New story!";
      var releaseLabel =
        story && formatStoryReleaseDateLabel(story.releaseDate);
      if (releaseLabel) {
        text += " " + releaseLabel;
        label += ". Released " + releaseLabel;
      }
    }
    return (
      '<span class="story-state-badge story-state-badge--' +
      kind +
      " story-state-badge--" +
      place +
      '" aria-label="' +
      escapeHtml(label) +
      '"><span class="story-state-badge-text">' +
      escapeHtml(text) +
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
      html += storyStateBadgeHtml("soon", "on-cover", s);
    } else if (st === 3) {
      html += storyStateBadgeHtml("in-progress", "on-cover", s);
    } else if (st === 2 && shouldShowNewStoryBadge(s)) {
      html += storyStateBadgeHtml("new", "on-cover", s);
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
      if (!flip || e.target !== flip || (e.key !== "Enter" && e.key !== " ")) {
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
    var seriesSelect = byId("series-select");
    var selectedSeriesId =
      seriesSelect && seriesSelect.value ? seriesSelect.value : null;
    var activeSeries = findStorySeries(selectedSeriesId);
    var lengthSelect = byId("length-select");
    var selectedLength =
      lengthSelect && lengthSelect.value ? lengthSelect.value : null;
    var modeEl = byId("brutality-mode");
    var levelEl = byId("brutality-level");
    var bMode = modeEl && modeEl.value ? modeEl.value : "";
    var bLevel = levelEl && levelEl.value ? levelEl.value : "3";

    var list = stories.filter(function (s) {
      if (!isStoryVisibleInCatalog(s)) return false;
      if (activeSeries && !storyInSeries(s, activeSeries)) return false;
      if (selectedTag && storyEffectiveTags(s).indexOf(selectedTag) === -1) {
        return false;
      }
      if (!passesLengthFilter(s, selectedLength)) return false;
      if (!passesBrutalityFilter(s, bMode, bLevel)) return false;
      return true;
    });
    var sorted = list.sort(function (a, b) {
      return compareStoriesForFilter(a, b, activeSeries);
    });
    grid.innerHTML = "";
    sorted.forEach(function (s) {
      var card = document.createElement("article");
      card.className = "story-card";
      card.setAttribute("data-story", s.id);
      var st = normalizeStoryState(s);
      var rowBadgeHtml = "";
      if (st === 1) {
        rowBadgeHtml = storyStateBadgeHtml("soon", "in-row", s);
      } else if (st === 3) {
        rowBadgeHtml = storyStateBadgeHtml("in-progress", "in-row", s);
      } else if (st === 2 && shouldShowNewStoryBadge(s)) {
        rowBadgeHtml = storyStateBadgeHtml("new", "in-row", s);
      }
      var rowPremiumHtml = "";
      if (storyHasPremiumTag(s)) {
        rowPremiumHtml = storyPremiumTagHtml("in-row");
      }
      var rowTrailingInner = rowBadgeHtml + rowPremiumHtml;
      var trailingRowHtml = rowTrailingInner
        ? '<div class="story-card-trailing">' + rowTrailingInner + "</div>"
        : "";
      var aiImagesOn = getAiImagesEnabled();
      if (!aiImagesOn) {
        card.className = "story-card story-card--text";
        card.innerHTML =
          '<div class="story-card-body">' +
          '<div class="story-card-title-row">' +
          '<span class="story-card-title">' +
          escapeHtml(s.title) +
          "</span>" +
          trailingRowHtml +
          "</div>" +
          storyTextListMetaHtml(s) +
          storyTextListBrutalityHtml(s) +
          storyTextListTagsHtml(s) +
          '<p class="story-card-summary">' +
          escapeHtml(s.summary || "") +
          "</p>" +
          storyTextListActionsHtml(s) +
          "</div>";
        grid.appendChild(card);
        return;
      }
      var coverWrapHtml = storyCoverMarkup(s, storyOnCoverBadgesHtml(s));
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
    return isStoryScenesVisibleOnSite(s);
  }

  function renderScenesPanel() {
    var root = byId("scenes-list");
    if (!root) return;
    var withScenes = stories
      .filter(function (s) {
        return isStoryVisibleInCatalog(s) && storyHasScenes(s);
      })
      .sort(function (a, b) {
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

  function humanizeCaptionSlug(slug) {
    return String(slug)
      .replace(/-/g, " ")
      .replace(/\b\w/g, function (ch) {
        return ch.toUpperCase();
      });
  }

  function normalizeCaptionEntry(entry) {
    if (entry == null || String(entry).trim() === "") return null;
    var slug = "";
    var media = "final.png";
    var graphicWarning = false;
    var graphicWarningCover = "";
    if (typeof entry === "object") {
      slug = entry.slug || entry.path || "";
      media = entry.media || entry.output || "final.png";
      graphicWarning = !!entry.graphicWarning;
      graphicWarningCover = entry.graphicWarningCover
        ? String(entry.graphicWarningCover)
        : "";
    } else {
      slug = entry;
    }
    slug = String(slug)
      .trim()
      .replace(/^assets\/captions\//, "")
      .replace(/\/final\.(png|gif|webp)$/i, "")
      .replace(/\/$/, "");
    if (!slug) return null;
    return {
      slug: slug,
      path: "assets/captions/" + slug + "/" + media,
      caption: "",
      alt: humanizeCaptionSlug(slug),
      graphicWarning: graphicWarning,
      graphicWarningCover: graphicWarningCover,
    };
  }

  /**
   * Accepts either a flat caption list (legacy) or section objects:
   *   { title: "…", captions: [ "slug", { slug, graphicWarning }, … ] }
   * Returns { sections, captions } where captions is the flat list used by
   * the lightbox (global indexes via data-caption-index).
   */
  function normalizeCaptionSections(entries) {
    var sections = [];
    var flat = [];
    (entries || []).forEach(function (entry) {
      if (entry == null) return;
      if (
        typeof entry === "object" &&
        entry.title != null &&
        Array.isArray(entry.captions)
      ) {
        var items = [];
        entry.captions.forEach(function (cap) {
          var item = normalizeCaptionEntry(cap);
          if (!item) return;
          item.globalIndex = flat.length;
          flat.push(item);
          items.push(item);
        });
        if (items.length) {
          sections.push({
            title: String(entry.title),
            items: items,
          });
        }
        return;
      }
      var item = normalizeCaptionEntry(entry);
      if (!item) return;
      item.globalIndex = flat.length;
      flat.push(item);
      if (!sections.length || sections[sections.length - 1].title !== "") {
        sections.push({ title: "", items: [] });
      }
      sections[sections.length - 1].items.push(item);
    });
    return { sections: sections, captions: flat };
  }

  var DEFAULT_GRAPHIC_WARNING_COVER =
    "assets/captions/graphic_warning_cover_v1.png";

  function buildCaptionFigure(item) {
    var fig = document.createElement("figure");
    fig.className = "scene-figure scene-figure--zoomable";
    fig.setAttribute("tabindex", "0");
    fig.setAttribute("title", "Click to enlarge");
    fig.setAttribute("data-caption-index", String(item.globalIndex));
    var capHtml = item.caption
      ? '<figcaption class="scene-caption">' +
        escapeHtml(item.caption) +
        "</figcaption>"
      : "";
    var mediaHtml =
      '<img src="' +
      escapeHtml(item.path) +
      '" alt="' +
      escapeHtml(item.alt || item.caption || "Caption image") +
      '" class="scene-img" loading="lazy">';
    if (item.graphicWarning) {
      fig.classList.add("scene-figure--graphic-warning");
      fig.setAttribute("title", "Click to reveal graphic content");
      var coverSrc = item.graphicWarningCover || DEFAULT_GRAPHIC_WARNING_COVER;
      mediaHtml =
        '<div class="caption-graphic-wrap">' +
        mediaHtml +
        '<button type="button" class="caption-graphic-cover" aria-label="Warning: graphically exposed testicles. Click to reveal.">' +
        '<img src="' +
        escapeHtml(coverSrc) +
        '" alt="" class="caption-graphic-cover-img" draggable="false">' +
        '<span class="caption-graphic-cover-hint">Click to reveal</span>' +
        "</button>" +
        "</div>";
    }
    fig.innerHTML = mediaHtml + capHtml;
    return fig;
  }

  function renderCaptionsPanel() {
    var root = byId("captions-list");
    if (!root) return;
    root.innerHTML = "";
    root.className = "captions-list";
    if (!captionSections.length) {
      root.innerHTML =
        '<p class="captions-intro">Nothing here yet — add sections to <code>data/captions.js</code>.</p>';
      return;
    }

    var hasNamedSections = captionSections.some(function (sec) {
      return sec.title;
    });
    if (hasNamedSections) {
      root.classList.add("captions-list--sections");
    }

    captionSections.forEach(function (sec) {
      if (!sec.items.length) return;
      if (!sec.title) {
        var bare = document.createElement("div");
        bare.className = "captions-section-body";
        sec.items.forEach(function (item) {
          bare.appendChild(buildCaptionFigure(item));
        });
        root.appendChild(bare);
        return;
      }

      var det = document.createElement("details");
      det.className = "captions-accordion";

      var sum = document.createElement("summary");
      sum.className = "captions-accordion-summary";
      var countLabel =
        sec.items.length + " caption" + (sec.items.length === 1 ? "" : "s");
      sum.innerHTML =
        '<span class="captions-accordion-chevron" aria-hidden="true"></span>' +
        '<span class="captions-accordion-heading">' +
        '<span class="captions-accordion-title">' +
        escapeHtml(sec.title) +
        "</span>" +
        '<span class="captions-accordion-count">' +
        countLabel +
        "</span>" +
        "</span>";
      det.appendChild(sum);

      var body = document.createElement("div");
      body.className = "captions-accordion-body";
      sec.items.forEach(function (item) {
        body.appendChild(buildCaptionFigure(item));
      });
      det.appendChild(body);
      root.appendChild(det);
    });
  }

  function renderFanartPanel() {
    var root = byId("fanart-list");
    if (!root) return;
    root.innerHTML = "";
    root.className = "fanart-list";
    if (!fanart.length) {
      root.innerHTML =
        '<p class="fanart-intro">Nothing here yet — fan art coming soon.</p>';
      return;
    }
    fanart.forEach(function (item) {
      if (!item || !item.path) return;
      var fig = document.createElement("figure");
      fig.className = "fanart-figure";
      var img = document.createElement("img");
      img.src = item.path;
      img.alt = item.alt || item.caption || "Fan art";
      img.loading = "lazy";
      fig.appendChild(img);
      if (item.caption || item.credit) {
        var cap = document.createElement("figcaption");
        var parts = [];
        if (item.caption) parts.push(escapeHtml(item.caption));
        if (item.credit) parts.push("<em>" + escapeHtml(item.credit) + "</em>");
        cap.innerHTML = parts.join(" — ");
        fig.appendChild(cap);
      }
      root.appendChild(fig);
    });
  }

  var connectionsGraphState = null;

  function connectionCharLinkButton(characterId, displayText) {
    return (
      '<button type="button" class="connections-char-link" data-character-id="' +
      escapeHtml(characterId) +
      '">' +
      escapeHtml(displayText) +
      "</button>"
    );
  }

  function connectionStoryLinkAnchor(story, displayText) {
    if (!story) return escapeHtml(displayText || "");
    var href = storyCatalogHref(story);
    return (
      '<a class="connections-story-link" href="' +
      escapeHtml(href) +
      '">' +
      escapeHtml(displayText || story.title || "a story") +
      "</a>"
    );
  }

  /**
   * Render infopanel markup: [[char:id]], [[char:id|text]], [[story:id]], [[story:id|text]].
   * Plain text is escaped (and spoiler-wrapped when spoilers are active).
   * Inserts a line break after each sentence-ending period outside [[...]] links
   * (periods inside link tags, e.g. Dr. Karen or a story title, do not break).
   */
  function renderInfopanelMarkup(text, textBit) {
    var src = String(text || "");
    var re = /\[\[(char|story):([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    var html = "";
    var last = 0;
    var m;

    function emitPlain(chunk) {
      if (!chunk) return;
      // Sentence breaks only in plain text — never inside link tags.
      var withBreaks = chunk.replace(/\.(\s+)/g, ".<br>");
      var parts = withBreaks.split("<br>");
      for (var i = 0; i < parts.length; i++) {
        if (i > 0) html += "<br>";
        html += textBit(parts[i]);
      }
    }

    while ((m = re.exec(src))) {
      emitPlain(src.slice(last, m.index));
      var kind = m[1];
      var id = String(m[2] || "").trim();
      var display = m[3] != null ? m[3] : null;
      if (kind === "char") {
        var ch = getCharacterById(id);
        html += connectionCharLinkButton(
          id,
          display != null ? display : (ch && ch.name) || id,
        );
      } else {
        var story = getStoryById(id);
        html += connectionStoryLinkAnchor(
          story,
          display != null ? display : (story && story.title) || id,
        );
      }
      last = m.index + m[0].length;
    }
    emitPlain(src.slice(last));
    return html;
  }

  function formatInfopanelEntryHtml(entry) {
    if (!entry || !entry.text) return "";
    var spoilerKey = connectionSpoilerKeyForStoryId(entry.storyId);
    var spoil =
      spoilerKey != null && !connectionSpoilersRevealedForKey(spoilerKey);
    function textBit(t) {
      if (!t) return "";
      return spoil ? connectionSpoilerTextHtml(t, spoilerKey) : escapeHtml(t);
    }
    return renderInfopanelMarkup(entry.text, textBit);
  }

  var connectionsSpoilersRevealed = {};
  var connectionsSpoilerPendingKey = null;

  /**
   * Spoiler scopes for the connections detail pane.
   * Keys: "andrea-lucas:1", "andrea-lucas:2", "bereavement", …
   */
  function connectionSpoilerKeyForStoryId(storyId) {
    var story = getStoryById(storyId);
    if (!story) return null;
    if (story.id === 49 || story.id === "49") return "bereavement";
    if (story.series && story.series.id === "andrea-lucas") {
      var order = story.series.order;
      if (typeof order === "number" && order >= 1) {
        return "andrea-lucas:" + order;
      }
    }
    return null;
  }

  function connectionSpoilerTitle(key) {
    if (key === "bereavement") return "Bereavement Counseling";
    var m = /^andrea-lucas:(\d+)$/.exec(String(key || ""));
    if (m) return "Andrea & Lucas Part " + m[1];
    return "these";
  }

  function connectionSpoilersRevealedForKey(key) {
    return !!(key && connectionsSpoilersRevealed[key]);
  }

  function connectionSpoilerTextHtml(text, key) {
    if (!text) return "";
    return (
      '<span class="connections-spoiler-text" tabindex="0" data-spoiler-key="' +
      escapeHtml(String(key)) +
      '" title="Click to reveal spoilers">' +
      escapeHtml(text) +
      "</span>"
    );
  }

  function closeConnectionsSpoilerModal() {
    var modal = byId("connections-spoiler-modal");
    if (modal) modal.hidden = true;
    connectionsSpoilerPendingKey = null;
    document.body.classList.remove("connections-spoiler-modal-open");
  }

  function openConnectionsSpoilerModal(key) {
    var modal = byId("connections-spoiler-modal");
    var body = byId("connections-spoiler-modal-body");
    if (!modal || !body || key == null) return;
    connectionsSpoilerPendingKey = key;
    body.textContent =
      "Are you sure you want to see " +
      connectionSpoilerTitle(key) +
      " spoilers?";
    modal.hidden = false;
    document.body.classList.add("connections-spoiler-modal-open");
    var confirmBtn = byId("connections-spoiler-confirm");
    if (confirmBtn) {
      try {
        confirmBtn.focus();
      } catch (e) {}
    }
  }

  function bindConnectionsSpoilerModal() {
    var modal = byId("connections-spoiler-modal");
    if (!modal || modal._connectionsSpoilerBound) return;
    modal._connectionsSpoilerBound = true;
    modal.addEventListener("click", function (ev) {
      var dismiss =
        ev.target &&
        ev.target.closest &&
        ev.target.closest("[data-spoiler-dismiss]");
      if (dismiss) {
        ev.preventDefault();
        closeConnectionsSpoilerModal();
        return;
      }
      var confirm =
        ev.target &&
        ev.target.closest &&
        ev.target.closest("#connections-spoiler-confirm");
      if (confirm) {
        ev.preventDefault();
        var key = connectionsSpoilerPendingKey;
        if (key != null) {
          connectionsSpoilersRevealed[key] = true;
          closeConnectionsSpoilerModal();
          if (connectionsGraphState && connectionsGraphState.selectedId) {
            renderConnectionsDetail(connectionsGraphState.selectedId);
          }
        } else {
          closeConnectionsSpoilerModal();
        }
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape") return;
      if (!modal.hidden) closeConnectionsSpoilerModal();
    });
  }

  /** Edge kind colors */
  var CONNECTION_KIND_ORDER = [
    "family",
    "relationship",
    "knows",
    "faction",
    "left",
    "right",
    "dick",
    "pain",
  ];
  var CONNECTION_KIND_COLORS = {
    family: "#4a8fdb",
    relationship: "#e07ab0",
    knows: "#5bb8c4",
    faction: "#8a9099",
    left: "#e0c14a",
    right: "#e25555",
    dick: "#8b6cf0",
    pain: "#5cbf6a",
  };
  var CONNECTION_KIND_LABELS = {
    family: "Family",
    relationship: "Romantically involved",
    knows: "Knows each other",
    faction: "Setting / faction",
    left: "Left ball popped",
    right: "Right ball popped",
    dick: "Dick broken or removed",
    pain: "Lots of testicular pain but no permanent damage",
  };
  var CONNECTION_KIND_LEGEND_LABELS = {
    family: "Family",
    relationship: "Romance",
    knows: "Knows",
    faction: "Faction",
    left: "Left popped",
    right: "Right popped",
    dick: "Dick broken/removed",
    pain: "Pain (no pop)",
  };
  var connectionsKindEnabled = {
    family: true,
    relationship: true,
    knows: true,
    faction: true,
    left: true,
    right: true,
    dick: true,
    pain: true,
  };
  var connectionsShowNames = true;

  function syncConnectionsNamesVisibility() {
    var wrap = byId("connections-graph-wrap");
    var input = byId("connections-names-toggle");
    if (input) input.checked = !!connectionsShowNames;
    if (wrap) {
      wrap.classList.toggle("names-hidden", !connectionsShowNames);
    }
  }

  function bindConnectionsNamesToggle() {
    var input = byId("connections-names-toggle");
    if (!input || input._connectionsNamesBound) return;
    input._connectionsNamesBound = true;
    input.addEventListener("change", function () {
      connectionsShowNames = !!input.checked;
      syncConnectionsNamesVisibility();
    });
    syncConnectionsNamesVisibility();
  }

  function hideConnectionsEdgeTooltip() {
    var tip = byId("connections-edge-tooltip");
    if (tip) tip.hidden = true;
  }

  function showConnectionsEdgeTooltip(edge, clientX, clientY) {
    var tip = byId("connections-edge-tooltip");
    if (!tip || !edge) return;
    var from = getCharacterById(edge.from);
    var to = getCharacterById(edge.to);
    var story = getStoryById(edge.storyId);
    var fromName = from ? from.name : edge.from;
    var toName = to ? to.name : edge.to;
    var kinds = connectionEdgeKinds(edge);
    var kindLabel = kinds
      .map(function (k) {
        return CONNECTION_KIND_LABELS[k] || k;
      })
      .join(" · ");
    var storyTitle = story ? story.title : "";
    tip.innerHTML =
      "<strong>" +
      escapeHtml(fromName) +
      "</strong> → " +
      escapeHtml(toName) +
      (kindLabel
        ? " — " + escapeHtml(kindLabel)
        : "") +
      (storyTitle
        ? '<span class="connections-edge-tooltip-story">' +
          escapeHtml(storyTitle) +
          "</span>"
        : "");
    tip.hidden = false;
    var pad = 14;
    var tw = tip.offsetWidth || 220;
    var th = tip.offsetHeight || 48;
    var x = clientX + pad;
    var y = clientY + pad;
    if (x + tw > window.innerWidth - 8) x = clientX - tw - pad;
    if (y + th > window.innerHeight - 8) y = clientY - th - pad;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }

  function setConnectionsKindPreset(preset) {
    var damaging = { left: true, right: true, dick: true, pain: true };
    if (preset === "damaging") {
      CONNECTION_KIND_ORDER.forEach(function (k) {
        connectionsKindEnabled[k] = !!damaging[k];
      });
    } else if (preset === "non-damaging") {
      CONNECTION_KIND_ORDER.forEach(function (k) {
        connectionsKindEnabled[k] = !damaging[k];
      });
    } else if (preset === "all") {
      CONNECTION_KIND_ORDER.forEach(function (k) {
        connectionsKindEnabled[k] = true;
      });
    } else if (preset === "none") {
      CONNECTION_KIND_ORDER.forEach(function (k) {
        connectionsKindEnabled[k] = false;
      });
    }
    renderConnectionsKindFilters();
    if (connectionsGraphState && connectionsGraphState.repaint) {
      connectionsGraphState.repaint();
    }
    if (connectionsGraphState && connectionsGraphState.selectedId) {
      renderConnectionsDetail(connectionsGraphState.selectedId);
    }
  }

  function renderConnectionsLegend() {
    var host = byId("connections-legend");
    if (!host) return;
    host.innerHTML = CONNECTION_KIND_ORDER.map(function (kind) {
      return (
        '<span class="connections-legend-item" role="listitem" title="' +
        escapeHtml(CONNECTION_KIND_LABELS[kind] || kind) +
        '">' +
        '<span class="connections-legend-swatch" style="background:' +
        CONNECTION_KIND_COLORS[kind] +
        '" aria-hidden="true"></span>' +
        '<span class="connections-legend-label">' +
        escapeHtml(CONNECTION_KIND_LEGEND_LABELS[kind] || kind) +
        "</span></span>"
      );
    }).join("");
  }

  function connectionsHashForCharacter(id) {
    return id ? "connections/" + id : "connections";
  }

  function findCharacterByQuery(query) {
    var q = String(query || "")
      .trim()
      .toLowerCase();
    if (!q) return null;
    var list = characters || [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id).toLowerCase() === q) return list[i];
    }
    for (i = 0; i < list.length; i++) {
      var n = list[i] && list[i].name ? String(list[i].name).toLowerCase() : "";
      if (n === q) return list[i];
    }
    var starts = null;
    for (i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c || !c.name) continue;
      var name = String(c.name).toLowerCase();
      var first = name.split(/\s+/)[0];
      if (name.indexOf(q) === 0 || first === q) {
        if (!starts) starts = c;
      }
    }
    if (starts) return starts;
    for (i = 0; i < list.length; i++) {
      if (
        list[i] &&
        list[i].name &&
        String(list[i].name).toLowerCase().indexOf(q) !== -1
      ) {
        return list[i];
      }
    }
    return null;
  }

  function syncConnectionsFindDatalist() {
    var dl = byId("connections-find-datalist");
    if (!dl) return;
    var names = (characters || [])
      .filter(function (c) {
        return c && c.name;
      })
      .map(function (c) {
        return c.name;
      })
      .sort(function (a, b) {
        return a.localeCompare(b, undefined, { sensitivity: "base" });
      });
    dl.innerHTML = names
      .map(function (name) {
        return "<option value=\"" + escapeHtml(name) + "\"></option>";
      })
      .join("");
  }

  function replaceConnectionsHash(id) {
    var wantHash = "#" + connectionsHashForCharacter(id);
    var nextSearch = location.search || "";
    try {
      var params = new URLSearchParams(nextSearch);
      if (params.has("c")) {
        params.delete("c");
        nextSearch = params.toString();
        nextSearch = nextSearch ? "?" + nextSearch : "";
      }
    } catch (e) {}
    var want = nextSearch + wantHash;
    var current = (location.search || "") + (location.hash || "");
    if (current === want) return;
    if (typeof history !== "undefined" && history.replaceState) {
      history.replaceState(null, "", want || "#connections");
    } else {
      location.hash = wantHash.slice(1);
    }
  }

  /**
   * Select a character on the graph, center the viewport, and optionally
   * sync the URL to #connections/<id>.
   */
  function focusConnectionsCharacter(id, opts) {
    opts = opts || {};
    if (!id) return;
    var ch = getCharacterById(id);
    if (!ch) {
      ch = findCharacterByQuery(id);
      if (ch) id = ch.id;
    }
    if (!ch) return;

    function applyFocus() {
      if (!connectionsGraphState || !connectionsGraphState.alive) return false;
      if (connectionsGraphState.setSelected) {
        connectionsGraphState.setSelected(id, { syncHash: false });
      }
      if (connectionsGraphState.centerOn) {
        connectionsGraphState.centerOn(id);
      }
      var input = byId("connections-find-input");
      if (input) input.value = ch.name || id;
      return true;
    }

    ensureConnectionsData().then(function () {
      if (!connectionsGraphState || !connectionsGraphState.alive) {
        initConnectionsGraph(true);
      }
      if (!applyFocus()) {
        requestAnimationFrame(function () {
          applyFocus();
        });
      }
    });

    if (opts.updateHash !== false) {
      replaceConnectionsHash(id);
    }
  }

  function bindConnectionsFind() {
    var input = byId("connections-find-input");
    if (!input || input._connectionsFindBound) return;
    input._connectionsFindBound = true;
    syncConnectionsFindDatalist();

    function jumpFromInput() {
      var ch = findCharacterByQuery(input.value);
      if (!ch) return;
      focusConnectionsCharacter(ch.id, { updateHash: true });
      input.blur();
    }

    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        jumpFromInput();
      }
    });
    input.addEventListener("change", function () {
      jumpFromInput();
    });
  }

  function openCharacterInConnections(id) {
    if (!id) return;
    setFlyoutPanelOpen(false);
    location.hash = connectionsHashForCharacter(id);
  }

  function connectionEdgePassesKindFilter(edge) {
    var kinds = connectionEdgeKinds(edge);
    for (var i = 0; i < kinds.length; i++) {
      if (connectionsKindEnabled[kinds[i]]) return true;
    }
    return false;
  }

  /** null until first render — then boolean; mobile defaults collapsed. */
  var connectionsKindFiltersCollapsed = null;

  function connectionsKindFiltersDefaultCollapsed() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 900px)").matches
    );
  }

  function syncConnectionsKindFiltersCollapsed(host) {
    if (!host) return;
    if (connectionsKindFiltersCollapsed === null) {
      connectionsKindFiltersCollapsed = connectionsKindFiltersDefaultCollapsed();
    }
    var collapsed = !!connectionsKindFiltersCollapsed;
    host.classList.toggle("is-collapsed", collapsed);
    var toggle = host.querySelector(".connections-kind-filters-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
    var title = host.querySelector(".connections-kind-filters-title");
    if (title) {
      title.textContent = collapsed ? "Show controls" : "Hide controls";
    }
  }

  function renderConnectionsKindFilters() {
    var host = byId("connections-kind-filters");
    if (!host) return;
    host.hidden = false;
    host.innerHTML =
      '<button type="button" class="connections-kind-filters-toggle" aria-controls="connections-kind-filters-body" aria-expanded="true">' +
      '<span class="connections-kind-filters-title">Hide controls</span>' +
      '<span class="connections-kind-filters-chevron" aria-hidden="true"></span>' +
      "</button>" +
      '<div class="connections-kind-filters-body" id="connections-kind-filters-body">' +
      '<div class="connections-kind-presets" role="group" aria-label="Filter presets">' +
      '<button type="button" class="connections-kind-preset" data-preset="damaging">Damaging</button>' +
      '<button type="button" class="connections-kind-preset" data-preset="non-damaging">Non-damaging</button>' +
      '<button type="button" class="connections-kind-preset" data-preset="all">Show all</button>' +
      '<button type="button" class="connections-kind-preset" data-preset="none">Hide all</button>' +
      "</div>" +
      '<ul class="connections-kind-filter-list">' +
      CONNECTION_KIND_ORDER.map(function (kind) {
        var checked = connectionsKindEnabled[kind] ? " checked" : "";
        return (
          '<li class="connections-kind-filter-item">' +
          '<label class="connections-kind-filter-label">' +
          '<input type="checkbox" class="connections-kind-filter-input" data-kind="' +
          escapeHtml(kind) +
          '"' +
          checked +
          " />" +
          '<span class="connections-kind-swatch" style="background:' +
          CONNECTION_KIND_COLORS[kind] +
          '" aria-hidden="true"></span>' +
          '<span class="connections-kind-filter-text">' +
          escapeHtml(CONNECTION_KIND_LABELS[kind] || kind) +
          "</span>" +
          "</label></li>"
        );
      }).join("") +
      "</ul></div>";
    syncConnectionsKindFiltersCollapsed(host);
  }

  function bindConnectionsKindFilters() {
    var host = byId("connections-kind-filters");
    if (!host || host._connectionsKindBound) return;
    host._connectionsKindBound = true;
    host.addEventListener("click", function (ev) {
      var toggleBtn =
        ev.target &&
        ev.target.closest &&
        ev.target.closest(".connections-kind-filters-toggle");
      if (toggleBtn && host.contains(toggleBtn)) {
        ev.preventDefault();
        if (connectionsKindFiltersCollapsed === null) {
          connectionsKindFiltersCollapsed =
            connectionsKindFiltersDefaultCollapsed();
        }
        connectionsKindFiltersCollapsed = !connectionsKindFiltersCollapsed;
        syncConnectionsKindFiltersCollapsed(host);
        return;
      }
      var presetBtn =
        ev.target &&
        ev.target.closest &&
        ev.target.closest(".connections-kind-preset");
      if (presetBtn && host.contains(presetBtn)) {
        var preset = presetBtn.getAttribute("data-preset");
        if (preset) setConnectionsKindPreset(preset);
      }
    });
    host.addEventListener("change", function (ev) {
      var input =
        ev.target &&
        ev.target.closest &&
        ev.target.closest(".connections-kind-filter-input");
      if (!input) return;
      var kind = input.getAttribute("data-kind");
      if (!kind) return;
      connectionsKindEnabled[kind] = !!input.checked;
      if (connectionsGraphState && connectionsGraphState.repaint) {
        connectionsGraphState.repaint();
      } else {
        initConnectionsGraph(true);
      }
      // Refresh detail list for current selection if any.
      if (connectionsGraphState && connectionsGraphState.selectedId) {
        renderConnectionsDetail(connectionsGraphState.selectedId);
      }
    });
  }

  function connectionEdgeKinds(edge) {
    function bothEndsWomen(e) {
      var a = e && getCharacterById(e.from);
      var b = e && getCharacterById(e.to);
      if (!a || !b) return false;
      if (a.entityType === "faction" || b.entityType === "faction")
        return false;
      return a.gender === "F" && b.gender === "F";
    }

    function involvesFaction(e) {
      var a = e && getCharacterById(e.from);
      var b = e && getCharacterById(e.to);
      return !!(
        (a && a.entityType === "faction") ||
        (b && b.entityType === "faction")
      );
    }

    function stripDamagingBetweenWomen(kindsList) {
      if (!bothEndsWomen(edge)) return kindsList;
      var safe = kindsList.filter(function (k) {
        return k !== "left" && k !== "right" && k !== "dick" && k !== "pain";
      });
      if (!safe.length) safe = ["knows"];
      return safe;
    }

    // Faction edges are always grey (setting / faction kind).
    if (involvesFaction(edge)) return ["faction"];

    var kinds =
      edge && Array.isArray(edge.kinds) && edge.kinds.length
        ? CONNECTION_KIND_ORDER.filter(function (k) {
            return edge.kinds.indexOf(k) !== -1;
          })
        : [];
    if (!kinds.length) {
      kinds = [bothEndsWomen(edge) ? "knows" : "pain"];
    }
    return stripDamagingBetweenWomen(kinds);
  }

  function connectionsEdgesForCharacter(charId) {
    return connections.filter(function (e) {
      return e && (e.from === charId || e.to === charId);
    });
  }

  function renderConnectionsDetail(charId) {
    var detail = byId("connections-detail");
    if (!detail) return;
    var character = getCharacterById(charId);
    if (!character) {
      detail.innerHTML =
        '<p class="connections-detail-empty">Select a character node to see their cast info and links.</p>';
      return;
    }

    var pics =
      character.profilePictures && character.profilePictures.length
        ? character.profilePictures
        : [PLACEHOLDER_CHAR];
    var isFactionDetail = character.entityType === "faction";
    var picsHtml =
      '<div class="flyout-profiles connections-detail-profiles' +
      (isFactionDetail ? " is-faction" : "") +
      '">' +
      pics
        .map(function (src, idx) {
          return (
            '<div class="flyout-profile-wrap">' +
            '<button type="button" class="flyout-profile-zoom" aria-label="' +
            escapeHtml(
              (character.name || "Character") +
                " — enlarge portrait" +
                (pics.length > 1 ? " (" + (idx + 1) + ")" : ""),
            ) +
            '" data-zoom-character="' +
            escapeHtml(character.id) +
            '" data-profile-index="' +
            idx +
            '">' +
            imgHtml({
              src: src,
              alt: "",
              className: "flyout-profile-img",
              placeholder: PLACEHOLDER_CHAR,
              extras: 'loading="lazy" decoding="async"',
            }) +
            "</button></div>"
          );
        })
        .join("") +
      "</div>";

    var metaHtml = "";
    if (isFactionDetail) {
      metaHtml = '<p class="flyout-character-meta">Setting / faction</p>';
    } else {
      var genderSymbol = character.gender === "F" ? "\u2640" : "\u2642";
      metaHtml = '<p class="flyout-character-meta">' + escapeHtml(genderSymbol);
      if (
        character.gender === "F" &&
        typeof character.testiclesKilled === "number"
      ) {
        metaHtml += " &middot; Testicles killed: " + character.testiclesKilled;
      }
      metaHtml += "</p>";
    }

    var entries = (connectionsInfopanel[charId] || []).slice().sort(function (a, b) {
      var ia = storyOrderIndexForCharacter(a && a.storyId, charId);
      var ib = storyOrderIndexForCharacter(b && b.storyId, charId);
      return ia - ib;
    });
    var linksHtml = "";
    if (entries.length) {
      linksHtml =
        '<div class="flyout-section"><h3 class="flyout-section-title">Connections</h3>' +
        '<ul class="connections-edge-list">' +
        entries
          .map(function (entry) {
            return (
              '<li class="connections-edge-sentence">' +
              formatInfopanelEntryHtml(entry) +
              "</li>"
            );
          })
          .join("") +
        "</ul></div>";
    } else {
      linksHtml =
        '<div class="flyout-section"><h3 class="flyout-section-title">Connections</h3>' +
        '<p class="connections-detail-empty">No connection notes for this character.</p></div>';
    }

    detail.innerHTML =
      '<div class="connections-detail-card">' +
      picsHtml +
      '<h2 class="flyout-title">' +
      escapeHtml(character.name || "") +
      "</h2>" +
      metaHtml +
      '<p class="flyout-summary">' +
      escapeHtml(character.bio || "") +
      "</p>" +
      linksHtml +
      "</div>";
  }

  function initConnectionsGraph(forceRestart) {
    var svg = byId("connections-graph");
    var wrap = byId("connections-graph-wrap");
    var detail = byId("connections-detail");
    if (!svg || !wrap) return;

    if (detail && !detail._connectionsBound) {
      detail._connectionsBound = true;
      detail.addEventListener("click", function (e) {
        var spoilerEl =
          e.target &&
          e.target.closest &&
          e.target.closest(".connections-spoiler-text");
        if (spoilerEl && detail.contains(spoilerEl)) {
          e.preventDefault();
          var key = spoilerEl.getAttribute("data-spoiler-key");
          if (key) {
            if (connectionSpoilersRevealedForKey(key)) {
              renderConnectionsDetail(
                connectionsGraphState && connectionsGraphState.selectedId,
              );
            } else {
              openConnectionsSpoilerModal(key);
            }
          }
          return;
        }
        var charBtn =
          e.target &&
          e.target.closest &&
          e.target.closest(".connections-char-link");
        if (charBtn && detail.contains(charBtn)) {
          var focusId = charBtn.getAttribute("data-character-id");
          if (
            focusId &&
            connectionsGraphState &&
            connectionsGraphState.setSelected
          ) {
            e.preventDefault();
            connectionsGraphState.setSelected(focusId);
          }
          return;
        }
        var pz =
          e.target &&
          e.target.closest &&
          e.target.closest(".flyout-profile-zoom");
        if (pz && detail.contains(pz)) {
          var cid = pz.getAttribute("data-zoom-character");
          var idxRaw = pz.getAttribute("data-profile-index");
          var ch = cid ? getCharacterById(cid) : null;
          var idx = typeof idxRaw === "string" ? parseInt(idxRaw, 10) : NaN;
          if (ch && !isNaN(idx) && idx >= 0) {
            e.preventDefault();
            openCharacterProfileLightbox(ch, idx);
            return;
          }
        }
        var storyBtn =
          e.target &&
          e.target.closest &&
          e.target.closest(".flyout-inline-link[data-story-id]");
        if (storyBtn && detail.contains(storyBtn)) {
          var sid = storyBtn.getAttribute("data-story-id");
          if (sid) {
            location.hash = storyCatalogHref(getStoryById(sid)).slice(1);
          }
        }
      });
    }

    // Already drawn — keep it (static layout; no live sim to resize).
    if (connectionsGraphState && connectionsGraphState.alive && !forceRestart) {
      return;
    }

    if (connectionsGraphState && connectionsGraphState.teardown) {
      connectionsGraphState.teardown();
    }
    if (connectionsGraphState && connectionsGraphState.raf) {
      cancelAnimationFrame(connectionsGraphState.raf);
    }

    var edges = (connections || []).filter(function (e) {
      return (
        e &&
        e.from &&
        e.to &&
        getCharacterById(e.from) &&
        getCharacterById(e.to)
      );
    });

    var seenIds = {};
    var nodes = [];
    function addNode(id) {
      if (!id || seenIds[id] || !getCharacterById(id)) return;
      seenIds[id] = true;
      var c = getCharacterById(id);
      nodes.push({
        id: id,
        name: (c && c.name) || id,
        gender: (c && c.gender) || "",
        entityType: (c && c.entityType) || "",
        pic: characterPortraitSrc(c),
        x: 0,
        y: 0,
        hubId: null,
      });
    }
    (characters || []).forEach(function (c) {
      if (c && c.id) addNode(c.id);
    });
    edges.forEach(function (e) {
      addNode(e.from);
      addNode(e.to);
    });

    if (!nodes.length) {
      svg.innerHTML = "";
      connectionsGraphState = null;
      return;
    }

    var nodeById = {};
    nodes.forEach(function (n) {
      nodeById[n.id] = n;
    });
    // One visual link per character pair: union kinds so multi-edge
    // relationships (e.g. Alyssa→Jon left + dick + right) render as
    // dashed multi-color, not stacked mono lines.
    var simEdges = (function mergeGraphConnectionEdges(rawEdges) {
      var byPair = Object.create(null);
      var order = [];
      (rawEdges || []).forEach(function (e) {
        if (!e || !e.from || !e.to) return;
        if (!nodeById[e.from] || !nodeById[e.to]) return;
        var key =
          e.from < e.to ? e.from + "\0" + e.to : e.to + "\0" + e.from;
        if (!byPair[key]) {
          byPair[key] = {
            from: e.from,
            to: e.to,
            kinds: [],
            _kindSeen: Object.create(null),
            storyId: e.storyId,
            sourceEdges: [],
          };
          order.push(key);
        }
        var g = byPair[key];
        g.sourceEdges.push(e);
        if (g.storyId == null && e.storyId != null) g.storyId = e.storyId;
        connectionEdgeKinds(e).forEach(function (k) {
          g._kindSeen[k] = true;
        });
      });
      return order.map(function (key) {
        var g = byPair[key];
        g.kinds = CONNECTION_KIND_ORDER.filter(function (k) {
          return g._kindSeen[k];
        });
        g.source = nodeById[g.from];
        g.target = nodeById[g.to];
        return g;
      });
    })(edges);

    // --- Spoke-and-wheel clustering ---
    var degree = {};
    var adj = {};
    var hubPreferAdj = {};
    edges.forEach(function (e) {
      degree[e.from] = (degree[e.from] || 0) + 1;
      degree[e.to] = (degree[e.to] || 0) + 1;
      if (!adj[e.from]) adj[e.from] = {};
      if (!adj[e.to]) adj[e.to] = {};
      adj[e.from][e.to] = (adj[e.from][e.to] || 0) + 1;
      adj[e.to][e.from] = (adj[e.to][e.from] || 0) + 1;
      if (e.hubPrefer) {
        if (!hubPreferAdj[e.from]) hubPreferAdj[e.from] = {};
        if (!hubPreferAdj[e.to]) hubPreferAdj[e.to] = {};
        hubPreferAdj[e.from][e.to] = true;
        hubPreferAdj[e.to][e.from] = true;
      }
    });

    // Connected components: largest = main catalog web; the rest are islands.
    var componentOf = {};
    var components = [];
    nodes.forEach(function (n) {
      if (componentOf[n.id] != null) return;
      var stack = [n.id];
      var comp = [];
      componentOf[n.id] = components.length;
      while (stack.length) {
        var uid = stack.pop();
        comp.push(uid);
        var nbrs = adj[uid] || {};
        Object.keys(nbrs).forEach(function (vid) {
          if (componentOf[vid] != null || !nodeById[vid]) return;
          componentOf[vid] = components.length;
          stack.push(vid);
        });
      }
      components.push(comp);
    });
    components.sort(function (a, b) {
      return b.length - a.length;
    });
    // Re-index after sort so componentOf matches sorted order.
    componentOf = {};
    components.forEach(function (comp, ci) {
      comp.forEach(function (id) {
        componentOf[id] = ci;
      });
    });
    var mainIds = {};
    (components[0] || []).forEach(function (id) {
      mainIds[id] = true;
    });
    var islandComps = components.slice(1);

    var ranked = nodes
      .filter(function (n) {
        return mainIds[n.id];
      })
      .sort(function (a, b) {
        return (degree[b.id] || 0) - (degree[a.id] || 0);
      });
    var isHub = {};
    var hubs = [];
    var maxHubs = 12;
    // Settings / factions always get their own wheels when connected.
    ranked.forEach(function (n) {
      if (hubs.length >= maxHubs) return;
      if (n.entityType !== "faction") return;
      if ((degree[n.id] || 0) < 1) return;
      isHub[n.id] = true;
      hubs.push(n);
    });
    ranked.forEach(function (n) {
      if (hubs.length >= maxHubs) return;
      if (isHub[n.id]) return;
      if ((degree[n.id] || 0) < 4) return;
      // Prefer hubs that aren't already a neighbor of an existing hub.
      var tooClose = hubs.some(function (h) {
        return adj[n.id] && adj[n.id][h.id];
      });
      if (tooClose && hubs.length >= 3) return;
      isHub[n.id] = true;
      hubs.push(n);
    });
    // Fallback: if almost no hubs, use top-degree characters.
    if (!hubs.length) {
      ranked.slice(0, Math.min(8, ranked.length)).forEach(function (n) {
        if ((degree[n.id] || 0) < 1) return;
        isHub[n.id] = true;
        hubs.push(n);
      });
    }

    var spokesByHub = {};
    hubs.forEach(function (h) {
      spokesByHub[h.id] = [];
      h.hubId = h.id;
    });

    nodes.forEach(function (n) {
      if (isHub[n.id] || !mainIds[n.id]) return;
      var best = null;
      var bestScore = -1;
      hubs.forEach(function (h) {
        var score = (adj[n.id] && adj[n.id][h.id]) || 0;
        // Direct faction membership should park a node on that faction's
        // wheel even when they also have several edges to character hubs.
        if (score > 0 && h.entityType === "faction") score += 100;
        // Explicit hubPrefer edges break ties across multiple factions.
        if (hubPreferAdj[n.id] && hubPreferAdj[n.id][h.id]) score += 50;
        if (score > bestScore) {
          bestScore = score;
          best = h;
        }
      });
      if (best && bestScore > 0) {
        n.hubId = best.id;
        spokesByHub[best.id].push(n);
      } else {
        n.hubId = null;
      }
    });

    // Pull in characters linked through spokes (multi-hop) so wheels fill out.
    var grew = true;
    while (grew) {
      grew = false;
      nodes.forEach(function (n) {
        if (isHub[n.id] || n.hubId || !mainIds[n.id] || !adj[n.id]) return;
        var bestHub = null;
        var bestScore = -1;
        Object.keys(adj[n.id]).forEach(function (otherId) {
          var other = nodeById[otherId];
          if (!other) return;
          var hid = isHub[other.id] ? other.id : other.hubId;
          if (!hid || !spokesByHub[hid]) return;
          var score = adj[n.id][otherId] || 0;
          if (score > bestScore) {
            bestScore = score;
            bestHub = hid;
          }
        });
        if (bestHub) {
          n.hubId = bestHub;
          spokesByHub[bestHub].push(n);
          grew = true;
        }
      });
    }

    // Main-web leftovers only (islands are laid out separately).
    var orphans = nodes.filter(function (n) {
      return mainIds[n.id] && !isHub[n.id] && !n.hubId;
    });

    // Compact circular clusters — short spokes, packed in a grid (not one big ring).
    function wheelRadius(spokeCount) {
      var n = Math.max(spokeCount, 1);
      return Math.max(56, (n * 64) / (2 * Math.PI));
    }

    function peripheralGridMeta(list) {
      var cell = 68;
      var gridCols = Math.max(1, Math.ceil(Math.sqrt(list.length)));
      var gridRows = Math.max(1, Math.ceil(list.length / gridCols));
      var halfW = ((gridCols - 1) * cell) / 2;
      var halfH = ((gridRows - 1) * cell) / 2;
      return {
        hub: null,
        spokes: list,
        r: Math.max(halfW, halfH) + 36,
        orphan: true,
        grid: true,
        gridCols: gridCols,
        gridRows: gridRows,
        cell: cell,
      };
    }

    function islandClusterMeta(idList) {
      var list = idList
        .map(function (id) {
          return nodeById[id];
        })
        .filter(Boolean);
      if (!list.length) return null;
      list.sort(function (a, b) {
        return (degree[b.id] || 0) - (degree[a.id] || 0);
      });
      var localHub = null;
      if (list.length >= 3 && (degree[list[0].id] || 0) >= 2) {
        localHub = list[0];
        isHub[localHub.id] = true;
        localHub.hubId = localHub.id;
        list.slice(1).forEach(function (s) {
          s.hubId = localHub.id;
        });
      }
      var spokes = localHub
        ? list.filter(function (n) {
            return n.id !== localHub.id;
          })
        : list;
      var r;
      if (localHub) {
        r = wheelRadius(spokes.length);
      } else if (list.length <= 2) {
        r = 36;
      } else {
        r = Math.max(40, (list.length * 56) / (2 * Math.PI));
      }
      var nodePad = 28;
      return {
        hub: localHub,
        spokes: spokes,
        r: r,
        boundingR: r + nodePad,
        island: true,
      };
    }

    /** Pack variable-radius circles tightly around a seed (not a grid). */
    function packCirclesNear(items, seedX, seedY, gap) {
      items.sort(function (a, b) {
        return b.boundingR - a.boundingR;
      });
      var placed = [];
      items.forEach(function (item, idx) {
        if (!placed.length) {
          item.cx = seedX;
          item.cy = seedY;
          placed.push(item);
          return;
        }
        var best = null;
        var bestScore = Infinity;
        for (var pi = 0; pi < placed.length; pi++) {
          var p = placed[pi];
          var ring = p.boundingR + item.boundingR + gap;
          var steps = 36;
          for (var s = 0; s < steps; s++) {
            var ang = (s / steps) * Math.PI * 2 + idx * 0.41;
            var cx = p.cx + Math.cos(ang) * ring;
            var cy = p.cy + Math.sin(ang) * ring;
            var overlaps = false;
            for (var qi = 0; qi < placed.length; qi++) {
              var q = placed[qi];
              var dx = cx - q.cx;
              var dy = cy - q.cy;
              var need = q.boundingR + item.boundingR + gap;
              if (dx * dx + dy * dy < need * need - 0.01) {
                overlaps = true;
                break;
              }
            }
            if (overlaps) continue;
            var score =
              (cx - seedX) * (cx - seedX) + (cy - seedY) * (cy - seedY);
            if (score < bestScore) {
              bestScore = score;
              best = { cx: cx, cy: cy };
            }
          }
        }
        if (!best) {
          var t = placed.length;
          best = {
            cx: seedX + Math.cos(t * 2.399963) * (90 + t * 48),
            cy: seedY + Math.sin(t * 2.399963) * (90 + t * 48),
          };
        }
        item.cx = best.cx;
        item.cy = best.cy;
        placed.push(item);
      });
    }

    function placeClusterNodes(w) {
      var wx = w.cx;
      var wy = w.cy;
      if (w.hub) {
        w.hub.x = wx;
        w.hub.y = wy;
      }
      if (w.grid) {
        var originX = wx - ((w.gridCols - 1) * w.cell) / 2;
        var originY = wy - ((w.gridRows - 1) * w.cell) / 2;
        w.spokes.forEach(function (s, si) {
          var gc = si % w.gridCols;
          var gr = Math.floor(si / w.gridCols);
          s.x = originX + gc * w.cell;
          s.y = originY + gr * w.cell;
        });
        return;
      }
      var count = Math.max(w.spokes.length, 1);
      w.spokes.forEach(function (s, si) {
        var a = (si / count) * Math.PI * 2 - Math.PI / 2;
        s.x = wx + Math.cos(a) * w.r;
        s.y = wy + Math.sin(a) * w.r;
      });
    }

    var wheelMeta = hubs.map(function (h) {
      return {
        hub: h,
        spokes: spokesByHub[h.id],
        r: wheelRadius(spokesByHub[h.id].length),
      };
    });
    // Sort largest wheels first for denser packing.
    wheelMeta.sort(function (a, b) {
      return b.r - a.r || b.spokes.length - a.spokes.length;
    });
    if (orphans.length) {
      wheelMeta.push(peripheralGridMeta(orphans));
    }

    var clusterGap = 130;
    var pad = 72;
    // Prefer a wide short grid so the canvas stays compact in the viewport.
    var targetCols = Math.max(
      2,
      Math.min(4, Math.ceil(Math.sqrt(Math.max(wheelMeta.length, 1) * 1.35))),
    );
    var cols = Math.min(targetCols, Math.max(wheelMeta.length, 1));
    var rows = Math.ceil(Math.max(wheelMeta.length, 1) / cols);

    // Per-column / per-row max radius so cells hug their wheels.
    var colMaxR = [];
    var rowMaxR = [];
    for (var ci = 0; ci < cols; ci++) colMaxR[ci] = 0;
    for (var ri = 0; ri < rows; ri++) rowMaxR[ri] = 0;
    wheelMeta.forEach(function (w, i) {
      var c = i % cols;
      var r = Math.floor(i / cols);
      if (w.r > colMaxR[c]) colMaxR[c] = w.r;
      if (w.r > rowMaxR[r]) rowMaxR[r] = w.r;
    });

    var colCenter = [];
    var x = pad;
    for (ci = 0; ci < cols; ci++) {
      colCenter[ci] = x + colMaxR[ci];
      x += colMaxR[ci] * 2 + clusterGap;
    }
    var rowCenter = [];
    var y = pad;
    for (ri = 0; ri < rows; ri++) {
      rowCenter[ri] = y + rowMaxR[ri];
      y += rowMaxR[ri] * 2 + clusterGap;
    }

    var width = Math.ceil(x - clusterGap + pad);
    var height = Math.ceil(y - clusterGap + pad);
    width = Math.max(width, 480);
    height = Math.max(height, 360);

    wheelMeta.forEach(function (w, wi) {
      var c = wi % cols;
      var r = Math.floor(wi / cols);
      w.cx = colCenter[c];
      w.cy = rowCenter[r];
      placeClusterNodes(w);
    });

    // Small disconnected islands: compact circles, packed as one organic cloud
    // to the right of the main catalog (non-overlapping, not a grid).
    var islandMeta = islandComps
      .map(islandClusterMeta)
      .filter(Boolean);
    if (islandMeta.length) {
      var islandGap = 52;
      var maxIslandR = 0;
      islandMeta.forEach(function (w) {
        if (w.boundingR > maxIslandR) maxIslandR = w.boundingR;
      });
      var seedX = width + clusterGap + maxIslandR;
      var seedY = height / 2;
      packCirclesNear(islandMeta, seedX, seedY, islandGap);
      var islMinY = Infinity;
      var islMaxY = -Infinity;
      var islMaxX = -Infinity;
      islandMeta.forEach(function (w) {
        islMinY = Math.min(islMinY, w.cy - w.boundingR);
        islMaxY = Math.max(islMaxY, w.cy + w.boundingR);
        islMaxX = Math.max(islMaxX, w.cx + w.boundingR);
      });
      var islShiftY = 0;
      if (islMinY < pad) islShiftY = pad - islMinY;
      if (islShiftY) {
        islandMeta.forEach(function (w) {
          w.cy += islShiftY;
        });
        islMaxY += islShiftY;
      }
      islandMeta.forEach(placeClusterNodes);
      width = Math.max(width, Math.ceil(islMaxX + pad));
      height = Math.max(height, Math.ceil(islMaxY + pad));
      wheelMeta = wheelMeta.concat(islandMeta);
    }

    var isNarrow =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 900px)").matches;
    var zoom = isNarrow ? 0.7 : 1.15;
    var zoomMin = isNarrow ? 0.4 : 0.5;
    var zoomMax = 3;
    var zoomStep = 0.2;

    function applyZoom() {
      svg.setAttribute("viewBox", "0 0 " + width + " " + height);
      svg.setAttribute("width", String(Math.round(width * zoom)));
      svg.setAttribute("height", String(Math.round(height * zoom)));
      var label = wrap.querySelector(
        '.connections-zoom-btn[data-zoom-action="reset"]',
      );
      if (label) label.textContent = Math.round(zoom * 100) + "%";
    }

    function setZoom(next) {
      zoom = Math.max(zoomMin, Math.min(zoomMax, next));
      applyZoom();
      if (connectionsGraphState) connectionsGraphState.zoom = zoom;
    }

    /** Zoom while keeping the content under (clientX, clientY) stable. */
    function setZoomAt(next, clientX, clientY) {
      var rect = wrap.getBoundingClientRect();
      var prev = zoom;
      var nextZoom = Math.max(zoomMin, Math.min(zoomMax, next));
      if (nextZoom === prev) return;
      var localX = clientX - rect.left;
      var localY = clientY - rect.top;
      var contentX = wrap.scrollLeft + localX;
      var contentY = wrap.scrollTop + localY;
      var fx = contentX / Math.max(1, width * prev);
      var fy = contentY / Math.max(1, height * prev);
      zoom = nextZoom;
      applyZoom();
      if (connectionsGraphState) connectionsGraphState.zoom = zoom;
      wrap.scrollLeft = fx * width * zoom - localX;
      wrap.scrollTop = fy * height * zoom - localY;
    }

    applyZoom();

    function clusterOf(n) {
      if (!n) return null;
      if (isHub[n.id]) return n.id;
      return n.hubId || "__orphan__";
    }

    function edgePathD(x1, y1, x2, y2, curved, bundleKey) {
      if (!curved) {
        return "M " + x1 + " " + y1 + " L " + x2 + " " + y2;
      }
      var mx = (x1 + x2) / 2;
      var my = (y1 + y2) / 2;
      var dx = x2 - x1;
      var dy = y2 - y1;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var px = -dy / len;
      var py = dx / len;
      var hash = 0;
      var key = String(bundleKey || "");
      for (var hi = 0; hi < key.length; hi++) {
        hash = (hash * 31 + key.charCodeAt(hi)) | 0;
      }
      var sign = hash % 2 === 0 ? 1 : -1;
      var bulge = Math.min(90, Math.max(28, len * 0.2)) * sign;
      return (
        "M " +
        x1 +
        " " +
        y1 +
        " Q " +
        (mx + px * bulge) +
        " " +
        (my + py * bulge) +
        " " +
        x2 +
        " " +
        y2
      );
    }

    var selectedId =
      (connectionsGraphState && connectionsGraphState.selectedId) || null;

    function paint() {
      var ns = "http://www.w3.org/2000/svg";
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      var neighSet = null;
      if (selectedId) {
        neighSet = {};
        neighSet[selectedId] = true;
        simEdges.forEach(function (e) {
          if (!connectionEdgePassesKindFilter(e)) return;
          if (e.from === selectedId) neighSet[e.to] = true;
          if (e.to === selectedId) neighSet[e.from] = true;
        });
      }

      var gGuides = document.createElementNS(ns, "g");
      gGuides.setAttribute("class", "connections-guides");
      wheelMeta.forEach(function (w) {
        if (w.grid || w.orphan) return;
        // Hubless island pairs/triples: no decorative ring.
        if (w.island && !w.hub) return;
        var ring = document.createElementNS(ns, "circle");
        ring.setAttribute("cx", w.cx);
        ring.setAttribute("cy", w.cy);
        ring.setAttribute("r", w.r);
        ring.setAttribute("class", "connections-wheel-ring");
        gGuides.appendChild(ring);
        if (w.hub) {
          w.spokes.forEach(function (s) {
            var spoke = document.createElementNS(ns, "line");
            spoke.setAttribute("x1", w.hub.x);
            spoke.setAttribute("y1", w.hub.y);
            spoke.setAttribute("x2", s.x);
            spoke.setAttribute("y2", s.y);
            spoke.setAttribute("class", "connections-spoke");
            gGuides.appendChild(spoke);
          });
        }
      });

      var gEdges = document.createElementNS(ns, "g");
      gEdges.setAttribute("class", "connections-edges");
      var gNodes = document.createElementNS(ns, "g");
      gNodes.setAttribute("class", "connections-nodes");

      simEdges.forEach(function (e, idx) {
        if (!e.source || !e.target) return;
        if (!connectionEdgePassesKindFilter(e)) return;
        var active =
          selectedId && (e.from === selectedId || e.to === selectedId);
        var dimmed = !!(selectedId && !active);
        var kinds = e.kinds && e.kinds.length ? e.kinds : ["pain"];
        kinds = kinds.filter(function (k) {
          return connectionsKindEnabled[k];
        });
        if (!kinds.length) return;

        var group = document.createElementNS(ns, "g");
        group.setAttribute(
          "class",
          "connections-edge-group" +
            (active ? " is-active" : "") +
            (dimmed ? " is-dimmed" : ""),
        );
        group.setAttribute("data-edge-index", String(idx));

        var cA = clusterOf(e.source);
        var cB = clusterOf(e.target);
        var curved = !!(cA && cB && cA !== cB);
        var d = edgePathD(
          e.source.x,
          e.source.y,
          e.target.x,
          e.target.y,
          curved,
          cA < cB ? cA + "|" + cB : cB + "|" + cA,
        );

        var hit = document.createElementNS(ns, "path");
        hit.setAttribute("d", d);
        hit.setAttribute("fill", "none");
        hit.setAttribute("class", "connections-edge-hit");
        hit.setAttribute("data-edge-index", String(idx));
        group.appendChild(hit);

        var dashLen = 10;
        var nKinds = kinds.length;
        kinds.forEach(function (kind, ki) {
          var line = document.createElementNS(ns, "path");
          line.setAttribute("d", d);
          line.setAttribute("fill", "none");
          line.setAttribute(
            "class",
            "connections-edge connections-edge--" + kind,
          );
          line.setAttribute("data-edge-index", String(idx));
          line.style.stroke =
            CONNECTION_KIND_COLORS[kind] || CONNECTION_KIND_COLORS.pain;
          if (nKinds > 1) {
            var gap = dashLen * (nKinds - 1);
            line.setAttribute(
              "stroke-dasharray",
              String(dashLen) + " " + String(gap),
            );
            line.setAttribute("stroke-dashoffset", String(-ki * dashLen));
          }
          group.appendChild(line);
        });
        gEdges.appendChild(group);
      });

      nodes.forEach(function (n) {
        var isFaction = n.entityType === "faction";
        var dimmed = !!(neighSet && !neighSet[n.id]);
        var g = document.createElementNS(ns, "g");
        g.setAttribute(
          "class",
          "connections-node" +
            (selectedId === n.id ? " is-selected" : "") +
            (isHub[n.id] ? " is-hub" : "") +
            (dimmed ? " is-dimmed" : "") +
            (isFaction ? " is-faction" : n.gender === "F" ? " is-f" : " is-m"),
        );
        g.setAttribute("transform", "translate(" + n.x + "," + n.y + ")");
        g.setAttribute("data-character-id", n.id);
        g.style.cursor = "grab";

        var clipId = "cn-clip-" + n.id.replace(/[^a-z0-9_-]/gi, "_");
        var defs = document.createElementNS(ns, "defs");
        var clip = document.createElementNS(ns, "clipPath");
        clip.setAttribute("id", clipId);
        var portraitR = isHub[n.id] ? (isNarrow ? 26 : 20) : isNarrow ? 20 : 15;
        if (isFaction && isHub[n.id]) {
          portraitR = isNarrow ? 30 : 24;
        }
        if (isFaction) {
          var factionCorner = Math.max(4, Math.round(portraitR * 0.28));
          var clipRect = document.createElementNS(ns, "rect");
          clipRect.setAttribute("x", String(-portraitR));
          clipRect.setAttribute("y", String(-portraitR));
          clipRect.setAttribute("width", String(portraitR * 2));
          clipRect.setAttribute("height", String(portraitR * 2));
          clipRect.setAttribute("rx", String(factionCorner));
          clipRect.setAttribute("ry", String(factionCorner));
          clip.appendChild(clipRect);
        } else {
          var clipCircle = document.createElementNS(ns, "circle");
          clipCircle.setAttribute("r", String(portraitR));
          clip.appendChild(clipCircle);
        }
        defs.appendChild(clip);
        g.appendChild(defs);

        var ringPad = 2;
        if (isFaction) {
          var ringCorner = Math.max(4, Math.round(portraitR * 0.28)) + ringPad;
          var ringSize = (portraitR + ringPad) * 2;
          var ring = document.createElementNS(ns, "rect");
          ring.setAttribute("x", String(-(portraitR + ringPad)));
          ring.setAttribute("y", String(-(portraitR + ringPad)));
          ring.setAttribute("width", String(ringSize));
          ring.setAttribute("height", String(ringSize));
          ring.setAttribute("rx", String(ringCorner));
          ring.setAttribute("ry", String(ringCorner));
          ring.setAttribute("class", "connections-node-ring");
          g.appendChild(ring);
        } else {
          var ring = document.createElementNS(ns, "circle");
          ring.setAttribute("r", String(portraitR + ringPad));
          ring.setAttribute("class", "connections-node-ring");
          g.appendChild(ring);
        }

        var img = document.createElementNS(ns, "image");
        img.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "href",
          n.pic || PLACEHOLDER_CHAR,
        );
        img.setAttribute("href", n.pic || PLACEHOLDER_CHAR);
        img.setAttribute("x", String(-portraitR));
        img.setAttribute("y", String(-portraitR));
        img.setAttribute("width", String(portraitR * 2));
        img.setAttribute("height", String(portraitR * 2));
        img.setAttribute("clip-path", "url(#" + clipId + ")");
        img.setAttribute("preserveAspectRatio", "xMidYMid slice");
        g.appendChild(img);

        var label = document.createElementNS(ns, "text");
        label.setAttribute("y", String(portraitR + (isNarrow ? 16 : 14)));
        label.setAttribute("class", "connections-node-label");
        var displayName = n.name || "";
        if (isNarrow && displayName.length > 18) {
          displayName = displayName.slice(0, 16).trim() + "…";
        }
        label.textContent = displayName;
        g.appendChild(label);

        gNodes.appendChild(g);
      });

      svg.appendChild(gGuides);
      svg.appendChild(gEdges);
      svg.appendChild(gNodes);
    }

    function handleGraphClickTarget(target) {
      if (!target || !target.closest) return;
      var nodeEl = target.closest(".connections-node");
      if (nodeEl) {
        var id = nodeEl.getAttribute("data-character-id");
        if (!id || !nodeById[id]) return;
        if (connectionsGraphState && connectionsGraphState.setSelected) {
          connectionsGraphState.setSelected(id);
        } else {
          selectedId = id;
          renderConnectionsDetail(id);
          paint();
        }
        return;
      }
      var line = target.closest("[data-edge-index]");
      if (line && !line.classList.contains("connections-node")) {
        var idx = parseInt(line.getAttribute("data-edge-index"), 10);
        var e = simEdges[idx];
        if (!e) return;
        var story = getStoryById(e.storyId);
        if (story) location.hash = storyCatalogHref(story).replace(/^#/, "");
        return;
      }
      if (connectionsGraphState && connectionsGraphState.setSelected) {
        connectionsGraphState.setSelected(null);
      } else {
        selectedId = null;
        hideConnectionsEdgeTooltip();
        var detailEl = byId("connections-detail");
        if (detailEl) {
          detailEl.innerHTML =
            '<p class="connections-detail-empty">Select a character node to see their cast info and links.</p>';
        }
        paint();
      }
    }

    svg.onclick = function (ev) {
      handleGraphClickTarget(ev.target);
    };

    svg.onmousemove = function (ev) {
      var line =
        ev.target &&
        ev.target.closest &&
        ev.target.closest("[data-edge-index]");
      if (!line || line.classList.contains("connections-node")) {
        hideConnectionsEdgeTooltip();
        return;
      }
      var idx = parseInt(line.getAttribute("data-edge-index"), 10);
      var e = simEdges[idx];
      if (!e) {
        hideConnectionsEdgeTooltip();
        return;
      }
      showConnectionsEdgeTooltip(e, ev.clientX, ev.clientY);
    };
    svg.onmouseleave = function () {
      hideConnectionsEdgeTooltip();
    };

    var zoomBar = byId("connections-zoom");
    if (zoomBar && !zoomBar._connectionsBound) {
      zoomBar._connectionsBound = true;
      zoomBar.addEventListener("click", function (ev) {
        var btn =
          ev.target &&
          ev.target.closest &&
          ev.target.closest("[data-zoom-action]");
        if (!btn || !connectionsGraphState) return;
        var action = btn.getAttribute("data-zoom-action");
        if (action === "in")
          connectionsGraphState.setZoom(connectionsGraphState.zoom + zoomStep);
        else if (action === "out")
          connectionsGraphState.setZoom(connectionsGraphState.zoom - zoomStep);
        else if (action === "reset")
          connectionsGraphState.setZoom(isNarrow ? 0.7 : 1.15);
      });
    }

    function onWheelZoom(ev) {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      var delta = ev.deltaY > 0 ? -zoomStep : zoomStep;
      setZoomAt(zoom + delta, ev.clientX, ev.clientY);
    }
    wrap.addEventListener("wheel", onWheelZoom, { passive: false });

    function connectionsTouchDist(touches) {
      var a = touches[0];
      var b = touches[1];
      var dx = a.clientX - b.clientX;
      var dy = a.clientY - b.clientY;
      return Math.sqrt(dx * dx + dy * dy) || 1;
    }
    function connectionsTouchCenter(touches) {
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      };
    }
    function connectionsIsChromeControl(el) {
      return !!(
        el &&
        el.closest &&
        (el.closest(".connections-zoom") ||
          el.closest(".connections-names-toggle") ||
          el.closest(".connections-find") ||
          el.closest(".connections-kind-filters"))
      );
    }

    var graphGesture = null;

    function endGraphGesture() {
      wrap.classList.remove("is-panning");
      wrap.classList.remove("is-dragging-node");
      graphGesture = null;
    }

    function clientToGraphCoords(clientX, clientY) {
      var rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 0, y: 0 };
      return {
        x: ((clientX - rect.left) / rect.width) * width,
        y: ((clientY - rect.top) / rect.height) * height,
      };
    }

    function connectionsNodeFromTarget(target) {
      return (
        (target &&
          target.closest &&
          target.closest(".connections-node")) ||
        null
      );
    }

    function beginNodeDragGesture(nodeId, clientX, clientY, extra) {
      var n = nodeById[nodeId];
      if (!n) return null;
      var g = clientToGraphCoords(clientX, clientY);
      var gesture = {
        mode: "drag-node",
        nodeId: nodeId,
        ox: n.x - g.x,
        oy: n.y - g.y,
        x0: clientX,
        y0: clientY,
        moved: false,
        captured: false,
      };
      if (extra) {
        Object.keys(extra).forEach(function (k) {
          gesture[k] = extra[k];
        });
      }
      return gesture;
    }

    function applyNodeDragAt(clientX, clientY) {
      if (!graphGesture || graphGesture.mode !== "drag-node") return;
      var n = nodeById[graphGesture.nodeId];
      if (!n) return;
      var g = clientToGraphCoords(clientX, clientY);
      var margin = 36;
      var nx = g.x + graphGesture.ox;
      var ny = g.y + graphGesture.oy;
      nx = Math.max(margin, Math.min(width - margin, nx));
      ny = Math.max(margin, Math.min(height - margin, ny));
      if (n.x === nx && n.y === ny && graphGesture.moved) return;
      n.x = nx;
      n.y = ny;
      paint();
    }

    function onGraphTouchStart(ev) {
      if (connectionsIsChromeControl(ev.target)) return;
      if (ev.touches.length === 2) {
        var c = connectionsTouchCenter(ev.touches);
        graphGesture = {
          mode: "pinch",
          dist0: connectionsTouchDist(ev.touches),
          zoom0: zoom,
        };
        wrap.classList.remove("is-panning");
        wrap.classList.remove("is-dragging-node");
        ev.preventDefault();
        return;
      }
      if (ev.touches.length === 1) {
        var t = ev.touches[0];
        var nodeEl = connectionsNodeFromTarget(ev.target);
        if (nodeEl) {
          var dragId = nodeEl.getAttribute("data-character-id");
          graphGesture = beginNodeDragGesture(dragId, t.clientX, t.clientY, {
            startTarget: ev.target,
          });
          if (graphGesture) return;
        }
        graphGesture = {
          mode: "pan",
          x0: t.clientX,
          y0: t.clientY,
          sl0: wrap.scrollLeft,
          st0: wrap.scrollTop,
          moved: false,
          // Remember hit target so a tap still selects even if the browser
          // drops the synthetic click after our touch handlers run.
          startTarget: ev.target,
        };
      }
    }

    function onGraphTouchMove(ev) {
      if (!graphGesture) return;
      if (graphGesture.mode === "pinch") {
        if (ev.touches.length < 2) return;
        ev.preventDefault();
        var dist = connectionsTouchDist(ev.touches);
        var center = connectionsTouchCenter(ev.touches);
        setZoomAt(
          graphGesture.zoom0 * (dist / graphGesture.dist0),
          center.x,
          center.y,
        );
        return;
      }
      if (graphGesture.mode === "drag-node" && ev.touches.length === 1) {
        var td = ev.touches[0];
        var ddx = td.clientX - graphGesture.x0;
        var ddy = td.clientY - graphGesture.y0;
        if (!graphGesture.moved && (Math.abs(ddx) > 6 || Math.abs(ddy) > 6)) {
          graphGesture.moved = true;
          wrap.classList.add("is-dragging-node");
          hideConnectionsEdgeTooltip();
          if (connectionsGraphState && connectionsGraphState.setSelected) {
            connectionsGraphState.setSelected(graphGesture.nodeId, {
              syncHash: true,
            });
          }
        }
        if (graphGesture.moved) {
          ev.preventDefault();
          applyNodeDragAt(td.clientX, td.clientY);
        }
        return;
      }
      if (graphGesture.mode === "pan" && ev.touches.length === 1) {
        var t = ev.touches[0];
        var dx = t.clientX - graphGesture.x0;
        var dy = t.clientY - graphGesture.y0;
        if (!graphGesture.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
          graphGesture.moved = true;
          wrap.classList.add("is-panning");
          hideConnectionsEdgeTooltip();
        }
        if (graphGesture.moved) {
          ev.preventDefault();
          wrap.scrollLeft = graphGesture.sl0 - dx;
          wrap.scrollTop = graphGesture.st0 - dy;
        }
      }
    }

    function onGraphTouchEnd(ev) {
      if (!graphGesture) return;
      if (graphGesture.mode === "pinch") {
        if (ev.touches.length >= 2) return;
        if (ev.touches.length === 1) {
          var t = ev.touches[0];
          graphGesture = {
            mode: "pan",
            x0: t.clientX,
            y0: t.clientY,
            sl0: wrap.scrollLeft,
            st0: wrap.scrollTop,
            moved: false,
            startTarget: ev.target,
          };
          return;
        }
        endGraphGesture();
        return;
      }
      if (ev.touches.length === 0) {
        var wasTap = !graphGesture.moved;
        var tapTarget = graphGesture.startTarget;
        if (graphGesture.moved) {
          wrap._connectionsSuppressClick = true;
          setTimeout(function () {
            wrap._connectionsSuppressClick = false;
          }, 0);
        }
        endGraphGesture();
        if (wasTap && tapTarget && !connectionsIsChromeControl(tapTarget)) {
          // Handle selection here; suppress the following synthetic click so
          // we don't double-fire (select then immediately clear).
          wrap._connectionsSuppressClick = true;
          setTimeout(function () {
            wrap._connectionsSuppressClick = false;
          }, 400);
          handleGraphClickTarget(tapTarget);
        }
      }
    }

    function onGraphPointerDown(ev) {
      if (ev.pointerType === "touch") return;
      if (ev.button !== 0) return;
      if (connectionsIsChromeControl(ev.target)) return;
      var nodeEl = connectionsNodeFromTarget(ev.target);
      if (nodeEl) {
        var dragId = nodeEl.getAttribute("data-character-id");
        graphGesture = beginNodeDragGesture(dragId, ev.clientX, ev.clientY, {
          pointerId: ev.pointerId,
        });
        if (graphGesture) return;
      }
      // Do not capture yet — capturing on the wrap retargets click away from
      // nodes/edges and breaks selection. Capture only after a real pan starts.
      graphGesture = {
        mode: "pan",
        pointerId: ev.pointerId,
        x0: ev.clientX,
        y0: ev.clientY,
        sl0: wrap.scrollLeft,
        st0: wrap.scrollTop,
        moved: false,
        captured: false,
      };
    }

    function onGraphPointerMove(ev) {
      if (!graphGesture) return;
      if (ev.pointerType === "touch") return;
      if (
        graphGesture.pointerId != null &&
        ev.pointerId !== graphGesture.pointerId
      ) {
        return;
      }
      if (graphGesture.mode === "drag-node") {
        var ddx = ev.clientX - graphGesture.x0;
        var ddy = ev.clientY - graphGesture.y0;
        if (!graphGesture.moved && (Math.abs(ddx) > 4 || Math.abs(ddy) > 4)) {
          graphGesture.moved = true;
          wrap.classList.add("is-dragging-node");
          hideConnectionsEdgeTooltip();
          if (!graphGesture.captured) {
            graphGesture.captured = true;
            try {
              wrap.setPointerCapture(ev.pointerId);
            } catch (err) {}
          }
          if (connectionsGraphState && connectionsGraphState.setSelected) {
            connectionsGraphState.setSelected(graphGesture.nodeId, {
              syncHash: true,
            });
          }
        }
        if (graphGesture.moved) {
          applyNodeDragAt(ev.clientX, ev.clientY);
        }
        return;
      }
      if (graphGesture.mode !== "pan") return;
      var dx = ev.clientX - graphGesture.x0;
      var dy = ev.clientY - graphGesture.y0;
      if (!graphGesture.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        graphGesture.moved = true;
        wrap.classList.add("is-panning");
        hideConnectionsEdgeTooltip();
        if (!graphGesture.captured) {
          graphGesture.captured = true;
          try {
            wrap.setPointerCapture(ev.pointerId);
          } catch (err) {}
        }
      }
      if (graphGesture.moved) {
        wrap.scrollLeft = graphGesture.sl0 - dx;
        wrap.scrollTop = graphGesture.st0 - dy;
      }
    }

    function onGraphPointerUp(ev) {
      if (ev.pointerType === "touch") return;
      if (
        graphGesture &&
        graphGesture.pointerId != null &&
        ev.pointerId !== graphGesture.pointerId
      ) {
        return;
      }
      if (graphGesture && graphGesture.moved) {
        wrap._connectionsSuppressClick = true;
        setTimeout(function () {
          wrap._connectionsSuppressClick = false;
        }, 0);
      }
      if (
        graphGesture &&
        graphGesture.captured &&
        graphGesture.pointerId != null
      ) {
        try {
          wrap.releasePointerCapture(graphGesture.pointerId);
        } catch (err) {}
      }
      endGraphGesture();
    }

    wrap.addEventListener("touchstart", onGraphTouchStart, { passive: false });
    wrap.addEventListener("touchmove", onGraphTouchMove, { passive: false });
    wrap.addEventListener("touchend", onGraphTouchEnd, { passive: false });
    wrap.addEventListener("touchcancel", endGraphGesture, { passive: true });
    wrap.addEventListener("pointerdown", onGraphPointerDown);
    wrap.addEventListener("pointermove", onGraphPointerMove);
    wrap.addEventListener("pointerup", onGraphPointerUp);
    wrap.addEventListener("pointercancel", onGraphPointerUp);

    var boundSvgClick = svg.onclick;
    svg.onclick = function (ev) {
      if (wrap._connectionsSuppressClick) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      if (typeof boundSvgClick === "function") boundSvgClick.call(svg, ev);
    };

    connectionsGraphState = {
      alive: true,
      raf: 0,
      width: width,
      height: height,
      zoom: zoom,
      selectedId: selectedId,
      setZoom: function (z) {
        setZoom(z);
      },
      resize: function () {},
      teardown: function () {
        svg.onclick = null;
        svg.onmousemove = null;
        svg.onmouseleave = null;
        svg.onmouseover = null;
        svg.onmouseout = null;
        hideConnectionsEdgeTooltip();
        wrap.removeEventListener("wheel", onWheelZoom);
        wrap.removeEventListener("touchstart", onGraphTouchStart);
        wrap.removeEventListener("touchmove", onGraphTouchMove);
        wrap.removeEventListener("touchend", onGraphTouchEnd);
        wrap.removeEventListener("touchcancel", endGraphGesture);
        wrap.removeEventListener("pointerdown", onGraphPointerDown);
        wrap.removeEventListener("pointermove", onGraphPointerMove);
        wrap.removeEventListener("pointerup", onGraphPointerUp);
        wrap.removeEventListener("pointercancel", onGraphPointerUp);
        wrap.classList.remove("is-panning");
      },
      setSelected: function (id, selOpts) {
        selOpts = selOpts || {};
        selectedId = id;
        connectionsGraphState.selectedId = id;
        if (id) renderConnectionsDetail(id);
        else {
          var detailEl = byId("connections-detail");
          if (detailEl) {
            detailEl.innerHTML =
              '<p class="connections-detail-empty">Select a character node to see their cast info and links.</p>';
          }
        }
        paint();
        if (selOpts.syncHash !== false) {
          replaceConnectionsHash(id || null);
        }
      },
      centerOn: function (id) {
        var n = nodeById[id];
        if (!n) return;
        var rect = wrap.getBoundingClientRect();
        var z = zoom;
        wrap.scrollLeft = n.x * z - rect.width / 2;
        wrap.scrollTop = n.y * z - rect.height / 2;
        var el = svg.querySelector(
          '.connections-node[data-character-id="' +
            String(id).replace(/"/g, "") +
            '"]',
        );
        if (el) {
          el.classList.remove("is-flash");
          void el.getBoundingClientRect();
          el.classList.add("is-flash");
          setTimeout(function () {
            el.classList.remove("is-flash");
          }, 1200);
        }
      },
      repaint: function () {
        paint();
      },
    };

    paint();
    if (selectedId) renderConnectionsDetail(selectedId);
  }

  var connectionsDataPromise = null;
  var connectionsDataReady = false;

  /** Pain ("no permanent damage") must not coexist with left/right pops for a pair. */
  function normalizeConnectionsData(list) {
    var arr = Array.isArray(list) ? list : [];
    var pairsWithPop = Object.create(null);
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      if (!e || !e.from || !e.to || !Array.isArray(e.kinds)) continue;
      if (e.kinds.indexOf("left") !== -1 || e.kinds.indexOf("right") !== -1) {
        var key =
          e.from < e.to ? e.from + "\0" + e.to : e.to + "\0" + e.from;
        pairsWithPop[key] = true;
      }
    }
    var out = [];
    for (var j = 0; j < arr.length; j++) {
      var edge = arr[j];
      if (!edge || !edge.from || !edge.to) continue;
      var kinds = Array.isArray(edge.kinds) ? edge.kinds.slice() : [];
      var pk =
        edge.from < edge.to
          ? edge.from + "\0" + edge.to
          : edge.to + "\0" + edge.from;
      if (pairsWithPop[pk]) {
        kinds = kinds.filter(function (k) {
          return k !== "pain";
        });
      }
      if (!kinds.length) continue;
      edge.kinds = kinds;
      out.push(edge);
    }
    return out;
  }

  function ensureConnectionsData() {
    if (connectionsDataReady) return Promise.resolve();
    if (connectionsDataPromise) return connectionsDataPromise;

    function loadScriptOnce(src, flagName) {
      if (window[flagName]) return Promise.resolve();
      return new Promise(function (resolve) {
        var s = document.createElement("script");
        s.src = src;
        s.onload = function () {
          resolve();
        };
        s.onerror = function () {
          resolve();
        };
        document.head.appendChild(s);
      });
    }

    connectionsDataPromise = loadScriptOnce(
      "data/connections.js",
      "DATA_CONNECTIONS",
    )
      .then(function () {
        return loadScriptOnce("data/infopanel.js", "DATA_INFOPANEL");
      })
      .then(function () {
        connections = normalizeConnectionsData(window.DATA_CONNECTIONS || []);
        connectionsInfopanel = window.DATA_INFOPANEL || {};
        connectionsDataReady = true;
      });
    return connectionsDataPromise;
  }

  function renderConnectionsPanel() {
    bindConnectionsSpoilerModal();
    bindConnectionsKindFilters();
    bindConnectionsNamesToggle();
    bindConnectionsFind();
    renderConnectionsLegend();
    renderConnectionsKindFilters();
    syncConnectionsNamesVisibility();
    syncConnectionsFindDatalist();
    ensureConnectionsData().then(function () {
      var needRestart = !connectionsGraphState || !connectionsGraphState.alive;
      initConnectionsGraph(needRestart);
      var state = parseHash();
      if (state.connectionsCharacterId) {
        focusConnectionsCharacter(state.connectionsCharacterId, {
          updateHash: false,
        });
      }
    });
  }

  function revealCaptionGraphic(fig) {
    if (!fig || !fig.classList.contains("scene-figure--graphic-warning")) {
      return false;
    }
    if (fig.classList.contains("is-revealed")) return false;
    fig.classList.add("is-revealed");
    fig.setAttribute("title", "Click to enlarge");
    var cover = fig.querySelector(".caption-graphic-cover");
    if (cover) cover.setAttribute("aria-hidden", "true");
    return true;
  }

  function captionSlides() {
    return captions
      .filter(function (item) {
        return item && item.path;
      })
      .map(function (item) {
        var cap = item.caption != null ? String(item.caption).trim() : "";
        return {
          path: item.path,
          caption: cap,
          alt: item.alt || cap || "Caption image",
        };
      });
  }

  function openCaptionLightboxForIndex(startIndex) {
    if (!sceneLightboxImg || !sceneLightbox) return;
    var slides = captionSlides();
    if (!slides.length) return;
    sceneLightboxProfileMode = false;
    sceneLightboxProfileName = null;
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

  function captionFigureTarget(fig) {
    if (!fig) return null;
    var img = fig.querySelector && fig.querySelector(".scene-img");
    if (!img || !img.getAttribute("src")) return null;
    var idxRaw = fig.getAttribute("data-caption-index");
    if (idxRaw == null) return null;
    var idx = parseInt(idxRaw, 10);
    if (isNaN(idx)) return null;
    return { idx: idx };
  }

  function bindCaptionFigureZoom(root) {
    if (!root || root._captionZoomBound) return;
    root._captionZoomBound = true;
    root.addEventListener("click", function (e) {
      var fig =
        e.target &&
        e.target.closest &&
        e.target.closest(".scene-figure--zoomable");
      if (!fig || !root.contains(fig)) return;
      if (revealCaptionGraphic(fig)) {
        e.preventDefault();
        return;
      }
      var t = captionFigureTarget(fig);
      if (!t) return;
      openCaptionLightboxForIndex(t.idx);
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var cover =
        e.target &&
        e.target.closest &&
        e.target.closest(".caption-graphic-cover");
      var fig =
        e.target &&
        e.target.closest &&
        e.target.closest(".scene-figure--zoomable");
      if (!fig || !root.contains(fig)) return;
      if (cover || fig === e.target) {
        if (revealCaptionGraphic(fig)) {
          e.preventDefault();
          return;
        }
        if (fig !== e.target && !cover) return;
        var t = captionFigureTarget(fig);
        if (!t) return;
        e.preventDefault();
        openCaptionLightboxForIndex(t.idx);
      }
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
  /** True when lightbox is showing cast profile(s); caption is full bio and styled for long text. */
  var sceneLightboxProfileMode = false;
  /** Name for aria-label when in profile mode (avoids reading the full bio). */
  var sceneLightboxProfileName = null;

  function slidesForCharacter(character) {
    if (!character) return [];
    var pics =
      character.profilePictures && character.profilePictures.length
        ? character.profilePictures.slice()
        : [PLACEHOLDER_CHAR];
    return pics.filter(Boolean).map(function (src) {
      return { path: src };
    });
  }

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
    sceneLightboxProfileMode = false;
    sceneLightboxProfileName = null;
    if (sceneLightboxCaption) {
      sceneLightboxCaption.classList.remove("scene-lightbox-caption--profile");
    }
    setSceneLightboxOpen(false);
  }

  function sceneSlidesForStory(story) {
    var out = [];
    if (!isStoryScenesVisibleOnSite(story)) return out;
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
    var wrapProfile = sceneLightboxProfileMode && n > 1;
    var prevLabel = sceneLightboxProfileMode
      ? "Previous portrait"
      : "Previous scene";
    var nextLabel = sceneLightboxProfileMode ? "Next portrait" : "Next scene";
    if (sceneLightboxPrev) {
      sceneLightboxPrev.setAttribute("aria-label", prevLabel);
      var hidePrev = n <= 1 || (!wrapProfile && i <= 0);
      sceneLightboxPrev.hidden = hidePrev;
      sceneLightboxPrev.disabled = hidePrev;
    }
    if (sceneLightboxNext) {
      sceneLightboxNext.setAttribute("aria-label", nextLabel);
      var hideNext = n <= 1 || (!wrapProfile && i >= n - 1);
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
    var capTrim = slide.caption != null ? String(slide.caption).trim() : "";
    if (sceneLightboxPanel) {
      var n = sceneLightboxSlides.length;
      var pos = sceneLightboxIndex + 1;
      var ariaBase =
        sceneLightboxProfileMode && sceneLightboxProfileName
          ? sceneLightboxProfileName + " portrait"
          : capTrim || slide.alt || "Scene";
      var label = n > 1 ? ariaBase + " (" + pos + " of " + n + ")" : ariaBase;
      sceneLightboxPanel.setAttribute("aria-label", label);
    }
    if (sceneLightboxCaption) {
      sceneLightboxCaption.classList.toggle(
        "scene-lightbox-caption--profile",
        sceneLightboxProfileMode && !!capTrim,
      );
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
    if (sceneLightboxProfileMode) {
      sceneLightboxIndex = (sceneLightboxIndex + delta + n) % n;
    } else {
      var next = sceneLightboxIndex + delta;
      if (next < 0 || next >= n) return;
      sceneLightboxIndex = next;
    }
    applySceneLightboxSlide();
  }

  function openSceneLightboxForStory(storyId, startIndex) {
    if (!sceneLightboxImg || !sceneLightbox) return;
    var story = getStoryById(storyId);
    var slides = sceneSlidesForStory(story);
    if (!slides.length) return;
    sceneLightboxProfileMode = false;
    sceneLightboxProfileName = null;
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

  function openCharacterProfileLightbox(character, startIndex) {
    if (!sceneLightboxImg || !sceneLightbox || !character) return;
    var paths = slidesForCharacter(character).map(function (s) {
      return s.path;
    });
    if (!paths.length) return;
    var bio =
      character.bio && String(character.bio).trim() ? character.bio.trim() : "";
    var nm = character.name || "Character";
    var slides = paths.map(function (path) {
      return {
        path: path,
        caption: bio,
        alt: nm + " portrait",
      };
    });
    sceneLightboxProfileMode = true;
    sceneLightboxProfileName = nm;
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
    bindCaptionFigureZoom(byId("captions-list"));
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
    fitSelectWidthToOptions(levelEl);
  }

  var filterSelectWidthMeasurer = null;

  function fitSelectWidthToOptions(select) {
    if (!select || !select.options || !select.options.length) return;
    if (!filterSelectWidthMeasurer) {
      filterSelectWidthMeasurer = document.createElement("span");
      filterSelectWidthMeasurer.setAttribute("aria-hidden", "true");
      filterSelectWidthMeasurer.style.cssText =
        "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;";
      document.body.appendChild(filterSelectWidthMeasurer);
    }
    var style = window.getComputedStyle(select);
    filterSelectWidthMeasurer.style.font = style.font;
    var maxText = 0;
    for (var i = 0; i < select.options.length; i++) {
      filterSelectWidthMeasurer.textContent = select.options[i].textContent;
      maxText = Math.max(
        maxText,
        filterSelectWidthMeasurer.getBoundingClientRect().width,
      );
    }
    var padL = parseFloat(style.paddingLeft) || 0;
    var padR = parseFloat(style.paddingRight) || 0;
    var borderL = parseFloat(style.borderLeftWidth) || 0;
    var borderR = parseFloat(style.borderRightWidth) || 0;
    select.style.width =
      Math.ceil(maxText + padL + padR + borderL + borderR + 2) + "px";
  }

  function fitStoryFilterSelects() {
    fitSelectWidthToOptions(byId("tag-select"));
    fitSelectWidthToOptions(byId("series-select"));
    fitSelectWidthToOptions(byId("length-select"));
    fitSelectWidthToOptions(byId("brutality-mode"));
    fitSelectWidthToOptions(byId("brutality-level"));
  }

  function scheduleStoryFilterSelectFit() {
    requestAnimationFrame(function () {
      fitStoryFilterSelects();
    });
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

    var seriesSelect = byId("series-select");
    if (seriesSelect) {
      seriesSelect.innerHTML = '<option value="">All series</option>';
      STORY_SERIES.forEach(function (series) {
        var opt = document.createElement("option");
        opt.value = series.id;
        opt.textContent = series.label;
        seriesSelect.appendChild(opt);
      });
      seriesSelect.addEventListener("change", function () {
        renderStoriesGrid();
      });
    }

    var lengthSelect = byId("length-select");
    if (lengthSelect) {
      lengthSelect.innerHTML = '<option value="">All lengths</option>';
      LENGTH_FILTER_OPTIONS.forEach(function (optDef) {
        var opt = document.createElement("option");
        opt.value = optDef.value;
        opt.textContent = optDef.label;
        lengthSelect.appendChild(opt);
      });
      lengthSelect.addEventListener("change", function () {
        renderStoriesGrid();
      });
    }

    var modeEl = byId("brutality-mode");
    var levelEl = byId("brutality-level");
    if (modeEl) {
      modeEl.addEventListener("change", function () {
        syncBrutalityLevelOptions();
        scheduleStoryFilterSelectFit();
        renderStoriesGrid();
      });
    }
    if (levelEl) {
      levelEl.addEventListener("change", function () {
        renderStoriesGrid();
      });
    }
    syncBrutalityLevelOptions();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleStoryFilterSelectFit);
    } else {
      scheduleStoryFilterSelectFit();
    }
  }

  /** Inline **bold**, *italic*, `code` for ratings panel (from markdown). */
  function formatInlineMd(s) {
    s = String(s);
    var out = "";
    var i = 0;
    while (i < s.length) {
      if (s.slice(i, i + 2) === "**") {
        var end = s.indexOf("**", i + 2);
        if (end === -1) {
          out += escapeHtml(s.slice(i));
          break;
        }
        out += "<strong>" + escapeHtml(s.slice(i + 2, end)) + "</strong>";
        i = end + 2;
        continue;
      }
      if (s[i] === "`") {
        var endC = s.indexOf("`", i + 1);
        if (endC === -1) {
          out += escapeHtml(s[i]);
          i++;
          continue;
        }
        out += "<code>" + escapeHtml(s.slice(i + 1, endC)) + "</code>";
        i = endC + 1;
        continue;
      }
      if (s[i] === "*" && i + 1 < s.length && s[i + 1] !== "*") {
        var endI = s.indexOf("*", i + 1);
        if (endI === -1) {
          out += escapeHtml(s[i]);
          i++;
          continue;
        }
        var inner = s.slice(i + 1, endI);
        if (inner.indexOf("\n") !== -1 || inner.length === 0) {
          out += escapeHtml(s[i]);
          i++;
          continue;
        }
        out += "<em>" + escapeHtml(inner) + "</em>";
        i = endI + 1;
        continue;
      }
      var cand = [];
      var ti = s.indexOf("`", i);
      if (ti !== -1) cand.push(ti);
      var db = s.indexOf("**", i);
      if (db !== -1) cand.push(db);
      var st = s.indexOf("*", i);
      while (st !== -1 && st + 1 < s.length && s[st + 1] === "*") {
        st = s.indexOf("*", st + 2);
      }
      if (st !== -1) cand.push(st);
      if (!cand.length) {
        out += escapeHtml(s.slice(i));
        break;
      }
      var next = Math.min.apply(null, cand);
      if (next > i) out += escapeHtml(s.slice(i, next));
      i = next;
    }
    return out;
  }

  function splitPipeRow(line) {
    var raw = line.trim();
    if (raw.indexOf("|") === -1) return null;
    if (raw[0] === "|") raw = raw.slice(1);
    if (raw.length && raw[raw.length - 1] === "|") raw = raw.slice(0, -1);
    return raw.split("|").map(function (c) {
      return c.trim();
    });
  }

  function isSeparatorRow(cells) {
    return cells.every(function (c) {
      var t = c.replace(/\s/g, "");
      return /^:?-+:?$/.test(t);
    });
  }

  function parsePipeTable(mdChunk) {
    var lines = String(mdChunk)
      .split("\n")
      .map(function (l) {
        return l.trim();
      })
      .filter(function (l) {
        return l.length > 0;
      });
    var rows = [];
    for (var ti = 0; ti < lines.length; ti++) {
      var cells = splitPipeRow(lines[ti]);
      if (!cells || !cells.length) continue;
      if (isSeparatorRow(cells)) continue;
      rows.push(cells);
    }
    return rows;
  }

  function extractMainCatalogTableMd(chunk) {
    var lines = String(chunk).split("\n");
    for (var i = 0; i < lines.length; i++) {
      if (/^\|\s*ID\s*\|/.test(lines[i])) {
        return lines.slice(i).join("\n");
      }
    }
    return "";
  }

  function renderIntroForRatings(introMd) {
    var lines = introMd.replace(/\r\n/g, "\n").trim().split("\n");
    if (lines.length && /^#\s+/.test(lines[0])) lines.shift();
    var html = "";
    var i = 0;
    while (i < lines.length) {
      if (!lines[i].trim()) {
        i++;
        continue;
      }
      if (lines[i].trim().indexOf("|") === 0) {
        var tblLines = [];
        while (i < lines.length && lines[i].trim().indexOf("|") === 0) {
          tblLines.push(lines[i]);
          i++;
        }
        var trows = parsePipeTable(tblLines.join("\n"));
        html += renderRatingsGenericTable(trows);
        continue;
      }
      var para = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        lines[i].trim().indexOf("|") !== 0
      ) {
        para.push(lines[i].trim());
        i++;
      }
      html +=
        '<p class="ratings-prose">' + formatInlineMd(para.join(" ")) + "</p>";
    }
    return html;
  }

  function renderRatingsGenericTable(rows) {
    if (!rows || !rows.length) return "";
    var h = rows[0];
    var body = rows.slice(1);
    var ths = h
      .map(function (c) {
        return "<th>" + formatInlineMd(c) + "</th>";
      })
      .join("");
    var trs = body
      .map(function (r) {
        return (
          "<tr>" +
          r
            .map(function (c) {
              return "<td>" + formatInlineMd(c) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    return (
      '<div class="ratings-table-wrap">' +
      '<table class="ratings-table ratings-table--intro"><thead><tr>' +
      ths +
      "</tr></thead><tbody>" +
      trs +
      "</tbody></table></div>"
    );
  }

  function renderAndreaRatingsCard(block) {
    var srcM = block.match(/\*\*Source reviewed:\*\*\s*`([^`]+)`/);
    var subtitle = "";
    if (srcM) {
      subtitle =
        '<p class="ratings-prose">' +
        formatInlineMd("**Source reviewed:** `" + srcM[1] + "`") +
        "</p>";
    }
    var tbl = parsePipeTable(block);
    var scores = null;
    for (var ri = 0; ri < tbl.length; ri++) {
      var row = tbl[ri];
      if (
        row.length === 4 &&
        /^[\d.]+$/.test(String(row[0]).replace(/[–—−]/g, "").trim())
      ) {
        scores = { w: row[0], a: row[1], i: row[2], e: row[3] };
        break;
      }
    }
    var whyM = block.match(/\*\*Why:\*\*\s*([\s\S]+)/);
    var why = whyM ? whyM[1].trim() : "";
    why = why.replace(/\n---\s*$/, "").trim();

    var scoresHtml = "";
    if (scores) {
      scoresHtml =
        '<div class="ratings-andrea-scores">' +
        [
          ["Writing", scores.w],
          ["Ambition", scores.a],
          ["Immersion", scores.i],
          ["Eroticism", scores.e],
        ]
          .map(function (p) {
            return (
              '<div class="ratings-andrea-score"><span class="ratings-andrea-score-label">' +
              escapeHtml(p[0]) +
              '</span><span class="ratings-andrea-score-value">' +
              escapeHtml(String(p[1])) +
              "</span></div>"
            );
          })
          .join("") +
        "</div>";
    }

    return (
      '<div class="ratings-andrea-card">' +
      subtitle +
      scoresHtml +
      (why
        ? '<p class="ratings-andrea-why">' + formatInlineMd(why) + "</p>"
        : "") +
      "</div>"
    );
  }

  function renderCatalogRatingsScoreTable(rows) {
    if (!rows || rows.length < 2) {
      return '<p class="ratings-status ratings-status--error">Could not parse the ratings table.</p>';
    }
    var head = rows[0];
    var data = rows.slice(1);
    var thHtml = head
      .map(function (text, idx) {
        var cls =
          idx === 0
            ? "ratings-th-id"
            : idx >= 2 && idx <= 5
              ? "ratings-th-num"
              : "";
        return (
          "<th" +
          (cls ? ' class="' + cls + '"' : "") +
          ">" +
          escapeHtml(text) +
          "</th>"
        );
      })
      .join("");
    var bodyHtml = data
      .map(function (r) {
        if (r.length < 7) return "";
        var id = r[0];
        var title = r[1];
        var story = getStoryById(id);
        var titleInner = story
          ? '<a href="#story/' +
            encodeURIComponent(String(story.id)) +
            '" class="ratings-title-link">' +
            formatInlineMd(title) +
            "</a>"
          : formatInlineMd(title);
        var nums = [r[2], r[3], r[4], r[5]].map(function (n) {
          var ns = String(n).trim();
          var na =
            ns === "-" ||
            ns.toUpperCase() === "N/A" ||
            /^[\u2013\u2014\u2212]$/.test(ns);
          return (
            '<td class="ratings-td-num">' +
            (na
              ? '<span class="ratings-na">' + escapeHtml(String(n)) + "</span>"
              : escapeHtml(String(n))) +
            "</td>"
          );
        });
        return (
          '<tr><td class="ratings-td-id">' +
          escapeHtml(id) +
          "</td><td>" +
          titleInner +
          "</td>" +
          nums.join("") +
          '<td class="ratings-td-notes">' +
          formatInlineMd(r[6] || "") +
          "</td></tr>"
        );
      })
      .filter(Boolean)
      .join("");
    return (
      '<div class="ratings-table-wrap">' +
      '<table class="ratings-table"><thead><tr>' +
      thHtml +
      "</tr></thead><tbody>" +
      bodyHtml +
      "</tbody></table></div>"
    );
  }

  function parseTakeawaysForRatings(text) {
    return text
      .split("\n")
      .map(function (l) {
        return l.trim();
      })
      .filter(function (l) {
        return l.indexOf("- ") === 0;
      })
      .map(function (l) {
        return l.slice(2).trim();
      });
  }

  function renderTakeawaysList(items) {
    if (!items.length) return "";
    return (
      '<ul class="ratings-takeaways">' +
      items
        .map(function (t) {
          return "<li>" + formatInlineMd(t) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function buildRatingsPanelHtml(md) {
    md = md.replace(/\r\n/g, "\n");
    var posAndrea = md.indexOf("## Andrea and Lucas");
    var posTable = md.indexOf("## Ratings table");
    var posTake = md.indexOf("## Quick comparative takeaways");
    var posRegen = md.indexOf("## Regenerating");

    var intro = posAndrea === -1 ? "" : md.slice(0, posAndrea).trim();
    var andreaBlock =
      posAndrea === -1 || posTable === -1
        ? ""
        : md.slice(posAndrea, posTable).trim();
    var tableChunk =
      posTable === -1
        ? ""
        : md.slice(posTable, posTake === -1 ? md.length : posTake);
    var takeChunk =
      posTake === -1
        ? ""
        : md.slice(posTake, posRegen === -1 ? md.length : posRegen);

    var introHtml = intro ? renderIntroForRatings(intro) : "";
    var andreaHtml = andreaBlock ? renderAndreaRatingsCard(andreaBlock) : "";
    var mainRows = parsePipeTable(extractMainCatalogTableMd(tableChunk));
    var takeItems = parseTakeawaysForRatings(takeChunk);

    var parts = [];
    if (introHtml) {
      parts.push(
        '<div class="ratings-section"><h2>About these ratings</h2>' +
          introHtml +
          "</div>",
      );
    }
    if (andreaHtml) {
      parts.push(
        '<div class="ratings-section"><h2>Andrea and Lucas (full published arc)</h2>' +
          andreaHtml +
          "</div>",
      );
    }
    parts.push(
      '<div class="ratings-section"><h2>All catalog IDs</h2>' +
        renderCatalogRatingsScoreTable(mainRows) +
        "</div>",
    );
    if (takeItems.length) {
      parts.push(
        '<div class="ratings-section"><h2>Quick comparative takeaways</h2>' +
          renderTakeawaysList(takeItems) +
          "</div>",
      );
    }
    return parts.join("");
  }

  function loadStoryCatalogRatings() {
    var root = byId("ratings-root");
    if (!root) return;
    fetch("docs/story-catalog-ratings.md")
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then(function (text) {
        root.innerHTML = buildRatingsPanelHtml(text);
        var lead = byId("ratings-lead");
        if (lead) lead.removeAttribute("hidden");
      })
      .catch(function () {
        root.innerHTML =
          '<p class="ratings-status ratings-status--error">Could not load <code>docs/story-catalog-ratings.md</code>. Run <code>npm start</code> from the project root and open this site from that server (not as a raw <code>file://</code> URL).</p>';
      });
  }

  // Hash: tabs (#stories, …), #character/<id>, #story/<id>, #story/<id>/read,
  //       #story/<id>/read/<n> (1-based chapter from the reader sidebar),
  //       #scenes/<id> (auto-expand that story's accordion)
  var TAB_IDS = [
    "stories",
    "characters",
    "scenes",
    "ratings",
    "captions",
    "fanart",
    "connections",
    "about",
    "other-authors",
  ];

  function localDistRatingsEnabled() {
    return document.documentElement.classList.contains("has-local-dist");
  }

  function checkLocalDistMarker() {
    return fetch(LOCAL_DIST_MARKER_URL, { credentials: "omit" }).then(
      function (r) {
        return r.ok;
      },
      function () {
        return false;
      },
    );
  }

  function showTab(name) {
    if (name === "ratings" && !localDistRatingsEnabled()) name = "stories";
    if (TAB_IDS.indexOf(name) === -1) name = "stories";
    var panels = qsAll(".panel");
    var tabs = qsAll(".tab[data-tab]");
    tabs.forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === name);
    });
    panels.forEach(function (p) {
      p.classList.toggle("active", p.id === "panel-" + name);
    });
    document.body.classList.toggle("tab-connections", name === "connections");
    syncTabsOtherActive(name);
    closeTabsOther();
    ensureLazyTabPanel(name);
  }

  var lazyTabPanelsDone = {};
  var pendingOtherAuthors = null;

  function ensureLazyTabPanel(name) {
    if (name === "connections") {
      requestAnimationFrame(function () {
        renderConnectionsPanel();
      });
      return;
    }
    if (lazyTabPanelsDone[name]) return;
    if (name === "characters") {
      lazyTabPanelsDone.characters = true;
      renderCharactersGrid();
    } else if (name === "scenes") {
      lazyTabPanelsDone.scenes = true;
      renderScenesPanel();
    } else if (name === "captions") {
      lazyTabPanelsDone.captions = true;
      renderCaptionsPanel();
    } else if (name === "fanart") {
      lazyTabPanelsDone.fanart = true;
      renderFanartPanel();
    } else if (name === "other-authors") {
      lazyTabPanelsDone["other-authors"] = true;
      renderOtherAuthors(pendingOtherAuthors);
    }
  }

  function closeTabsOther() {
    var wrap = document.querySelector(".tabs-other");
    var toggle = byId("tabs-other-toggle");
    var menu = byId("tabs-other-menu");
    if (wrap) wrap.classList.remove("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (menu) menu.hidden = true;
  }

  function syncTabsOtherActive(name) {
    var toggle = byId("tabs-other-toggle");
    if (!toggle) return;
    var inOther = false;
    qsAll(".tabs-other-menu .tab[data-tab]").forEach(function (t) {
      if (t.getAttribute("data-tab") === name) inOther = true;
    });
    toggle.classList.toggle("is-active", inOther);
  }

  function initTabsOtherMenu() {
    var wrap = document.querySelector(".tabs-other");
    var toggle = byId("tabs-other-toggle");
    var menu = byId("tabs-other-menu");
    if (!wrap || !toggle || !menu || wrap._tabsOtherBound) return;
    wrap._tabsOtherBound = true;

    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = !wrap.classList.contains("is-open");
      if (open) {
        wrap.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
        menu.hidden = false;
      } else {
        closeTabsOther();
      }
    });

    document.addEventListener("click", function (e) {
      if (!wrap.classList.contains("is-open")) return;
      if (wrap.contains(e.target)) return;
      closeTabsOther();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeTabsOther();
    });
  }

  function connectionsCharacterFromQuery() {
    try {
      var params = new URLSearchParams(location.search || "");
      var c = params.get("c");
      return c && String(c).trim() ? String(c).trim() : "";
    } catch (e) {
      return "";
    }
  }

  function parseHash() {
    var raw = (location.hash || "").replace(/^#/, "").toLowerCase();
    var parts = raw.split("/").filter(function (p) {
      return p.length > 0;
    });
    var first = parts[0] || "";
    var queryChar = connectionsCharacterFromQuery();
    if (first === "character" && parts[1]) {
      return { tab: "characters", characterId: parts[1] };
    }
    if (first === "story" && parts[1]) {
      var storyIdRaw = parts[1];
      var num = parseInt(storyIdRaw, 10);
      var sid = String(num) === storyIdRaw ? num : storyIdRaw;
      var readMode = parts[2] === "read";
      var chapter = null;
      if (readMode && parts[3]) {
        var chNum = parseInt(parts[3], 10);
        if (String(chNum) === parts[3] && chNum >= 1) chapter = chNum;
      }
      return {
        tab: "stories",
        storyId: sid,
        readMode: readMode,
        chapter: chapter,
      };
    }
    if (first === "scenes" && parts[1]) {
      var scStoryRaw = parts[1];
      var scNum = parseInt(scStoryRaw, 10);
      var scSid = String(scNum) === scStoryRaw ? scNum : scStoryRaw;
      return { tab: "scenes", scenesStoryId: scSid };
    }
    if (first === "connections" || (!first && queryChar)) {
      return {
        tab: "connections",
        connectionsCharacterId: parts[1] || queryChar || undefined,
      };
    }
    var tab = TAB_IDS.indexOf(first) !== -1 ? first : "stories";
    return { tab: tab };
  }

  function initTabs() {
    initTabsOtherMenu();
    var tabs = qsAll(".tab[data-tab]");

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function (e) {
        var name = tab.getAttribute("data-tab");
        if (!name) return; // e.g. OverEasy Catalogue → real page link
        e.preventDefault();
        showTab(name);
        location.hash = name;
      });
    });
  }

  function renderCharacterCard(c) {
    var card = document.createElement("article");
    card.className = "character-card";
    card.setAttribute("data-character", c.id);
    var fullSrc = characterPortraitSrc(c, { full: true });
    card.innerHTML =
      '<button type="button" class="character-avatar-zoom" data-character-id="' +
      escapeHtml(c.id) +
      '" aria-label="' +
      escapeHtml((c.name || "Character") + " — enlarge portrait and show bio") +
      '">' +
      '<span class="character-avatar-wrap">' +
      imgHtml({
        src: fullSrc,
        alt: c.name,
        className: "character-avatar",
        placeholder: PLACEHOLDER_CHAR,
        extras: 'loading="lazy" decoding="async"',
      }) +
      "</span></button>" +
      '<span class="character-card-name">' +
      escapeHtml(c.name) +
      "</span>";
    return card;
  }

  var CHARACTERS_SORT_BY_STORY_KEY = "charactersSortByStory";

  function getCharactersSortByStory() {
    try {
      return localStorage.getItem(CHARACTERS_SORT_BY_STORY_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setCharactersSortByStory(on) {
    try {
      if (on) localStorage.setItem(CHARACTERS_SORT_BY_STORY_KEY, "1");
      else localStorage.removeItem(CHARACTERS_SORT_BY_STORY_KEY);
    } catch (e) {}
  }

  function updateCharactersSortControlState() {
    var wrap = byId("characters-sort");
    var sortToggle = byId("characters-sort-by-story");
    if (!sortToggle) return;
    if (wrap) {
      wrap.classList.toggle("characters-sort--by-story", sortToggle.checked);
      wrap.classList.toggle("characters-sort--by-gender", !sortToggle.checked);
    }
    sortToggle.setAttribute(
      "aria-checked",
      sortToggle.checked ? "true" : "false",
    );
  }

  function bindCharactersSortToggle() {
    var sortToggle = byId("characters-sort-by-story");
    if (!sortToggle || sortToggle.dataset.bound) return;
    sortToggle.dataset.bound = "1";
    sortToggle.checked = getCharactersSortByStory();
    updateCharactersSortControlState();
    sortToggle.addEventListener("change", function () {
      setCharactersSortByStory(sortToggle.checked);
      updateCharactersSortControlState();
      if (lazyTabPanelsDone.characters) renderCharactersGrid();
    });
  }

  function nameSort(a, b) {
    return (a.name || "").localeCompare(b.name || "", undefined, {
      sensitivity: "base",
    });
  }

  /** Cast panel: Female / Male / Factions blocks, or one subsection per story. */
  function renderCharactersGrid() {
    var charactersGrid = byId("characters-grid");
    if (!charactersGrid || !characters.length) return;
    charactersGrid.innerHTML = "";
    var byStory = getCharactersSortByStory();

    var charById = {};
    characters.forEach(function (c) {
      charById[c.id] = c;
    });

    function isFactionEntity(c) {
      return !!(c && c.entityType === "faction");
    }

    function appendFactionSection() {
      var factions = characters.filter(isFactionEntity);
      if (!factions.length) return;
      factions.sort(nameSort);
      var section = document.createElement("div");
      var heading = document.createElement("h2");
      heading.className = "characters-section-title";
      heading.textContent = "Factions";
      section.appendChild(heading);
      var grid = document.createElement("div");
      grid.className = "characters-grid-inner";
      factions.forEach(function (c) {
        grid.appendChild(renderCharacterCard(c));
      });
      section.appendChild(grid);
      charactersGrid.appendChild(section);
    }

    if (byStory) {
      var placedInAnyStory = {};
      stories
        .slice()
        .sort(compareStories)
        .forEach(function (story) {
          var ids = story.characterIds || [];
          var seenId = {};
          var row = [];
          ids.forEach(function (cid) {
            if (seenId[cid]) return;
            seenId[cid] = true;
            var ch = charById[cid];
            if (ch && !isFactionEntity(ch)) {
              row.push(ch);
              placedInAnyStory[ch.id] = true;
            }
          });
          if (!row.length) return;
          row.sort(nameSort);
          var sub = document.createElement("div");
          sub.className = "characters-story-group";
          var h3 = document.createElement("h3");
          h3.className = "characters-story-title";
          var storyLink = document.createElement("a");
          storyLink.href = storyCatalogHref(story);
          storyLink.textContent = story.title || "Story " + story.id;
          h3.appendChild(storyLink);
          sub.appendChild(h3);
          var grid = document.createElement("div");
          grid.className = "characters-grid-inner";
          row.forEach(function (c) {
            grid.appendChild(renderCharacterCard(c));
          });
          sub.appendChild(grid);
          charactersGrid.appendChild(sub);
        });

      var orphans = characters.filter(function (c) {
        return !placedInAnyStory[c.id] && !isFactionEntity(c);
      });
      if (orphans.length) {
        orphans.sort(nameSort);
        var orphanWrap = document.createElement("div");
        orphanWrap.className = "characters-story-group";
        var oh = document.createElement("h3");
        oh.className = "characters-story-title";
        oh.textContent = "Other characters";
        orphanWrap.appendChild(oh);
        var oGrid = document.createElement("div");
        oGrid.className = "characters-grid-inner";
        orphans.forEach(function (c) {
          oGrid.appendChild(renderCharacterCard(c));
        });
        orphanWrap.appendChild(oGrid);
        charactersGrid.appendChild(orphanWrap);
      }
      appendFactionSection();
      return;
    }

    var byGender = { F: [], M: [] };
    characters.forEach(function (c) {
      if (isFactionEntity(c)) return;
      var g = c.gender || "M";
      if (byGender[g]) byGender[g].push(c);
    });
    ["F", "M"].forEach(function (gender) {
      var list = byGender[gender];
      if (!list.length) return;
      list.sort(nameSort);
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
    appendFactionSection();
  }

  function initCharactersGrid() {
    bindCharactersSortToggle();
    // Grid HTML is deferred until the Cast tab opens (see ensureLazyTabPanel).
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

  function bindKofiPrefTipRoot(root) {
    if (!root || root._storyKofiPrefTipBound) return;
    root._storyKofiPrefTipBound = true;
    root.addEventListener("pointerover", function (e) {
      var anchor =
        e.target &&
        e.target.closest &&
        e.target.closest("[data-kofi-pref-tooltip]");
      if (!anchor || !root.contains(anchor)) return;
      var msg = anchor.getAttribute("data-kofi-pref-tooltip");
      if (!msg) return;
      showStoryKofiPrefTip(anchor, msg);
    });
    root.addEventListener("pointerout", function (e) {
      var anchor =
        e.target &&
        e.target.closest &&
        e.target.closest("[data-kofi-pref-tooltip]");
      if (!anchor || !root.contains(anchor)) return;
      var rt = e.relatedTarget;
      if (rt && anchor.contains(rt)) return;
      if (document.activeElement === anchor) return;
      hideStoryKofiPrefTip();
    });
    root.addEventListener("focusin", function (e) {
      var anchor =
        e.target &&
        e.target.closest &&
        e.target.closest("[data-kofi-pref-tooltip]");
      if (!anchor || !root.contains(anchor)) return;
      var msg = anchor.getAttribute("data-kofi-pref-tooltip");
      if (!msg) return;
      showStoryKofiPrefTip(anchor, msg);
    });
    root.addEventListener("focusout", function (e) {
      var anchor =
        e.target &&
        e.target.closest &&
        e.target.closest("[data-kofi-pref-tooltip]");
      if (!anchor || !root.contains(anchor)) return;
      var rt = e.relatedTarget;
      if (rt && anchor.contains(rt)) return;
      storyKofiPrefTipHideTimer = setTimeout(function () {
        hideStoryKofiPrefTip();
      }, 0);
    });
    root.addEventListener("scroll", hideStoryKofiPrefTip, { passive: true });
  }

  function bindStoryKofiPrefTipUi() {
    bindKofiPrefTipRoot(flyoutBody);
    bindKofiPrefTipRoot(storyReaderScroll || storyReaderEl);
    if (flyoutPanel && !flyoutPanel._storyKofiPrefTipScrollBound) {
      flyoutPanel._storyKofiPrefTipScrollBound = true;
      flyoutPanel.addEventListener("scroll", hideStoryKofiPrefTip, {
        passive: true,
      });
    }
    if (!window._storyKofiPrefTipResizeBound) {
      window._storyKofiPrefTipResizeBound = true;
      window.addEventListener("resize", hideStoryKofiPrefTip);
    }
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
  /** 1-based chapter to scroll to after markdown renders; cleared once used. */
  var pendingReaderChapter = null;
  /** Last 0-based chapter written to the hash via scroll/click sync. */
  var lastSyncedReaderChapter = null;
  /** Skip scroll-spy hash writes during programmatic chapter jumps. */
  var suppressChapterHashSync = false;

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

  /** Drop emphasis markers the inline parser could not pair (nested/malformed md). */
  function stripRemainingMarkdownAsterisks(s) {
    return s.replace(/\*/g, "");
  }

  function readerFormatEscapedInline(escaped) {
    var s = mergeEmphasisAcrossNewlines(escaped);
    s = linkifyEscapedMarkdown(s);
    s = readerInlineEmphasis(s);
    s = stripRemainingMarkdownAsterisks(s);
    return s;
  }

  var DOC_INLINE_CLASS =
    "(?:doc-(?:font-(?:mono|serif|comic)|size-[\\d.]+pt|color-[0-9a-fA-F]{3,8}))";
  var PRESERVED_INLINE_CHUNK_RE = new RegExp(
    '<span class="(' +
      DOC_INLINE_CLASS +
      "(?:\\s+" +
      DOC_INLINE_CLASS +
      ')*)">([\\s\\S]*?)<\\/span>|<u>([\\s\\S]*?)<\\/u>',
    "g",
  );

  function hasPreservedInlineHtml(block) {
    return /class="doc-(?:font|size|color)-|<\/?u>/i.test(block);
  }

  function formatPreservedInner(inner) {
    if (hasPreservedInlineHtml(inner)) {
      return formatBodyInline(inner);
    }
    var escaped = escapeHtml(inner).replace(/\r\n/g, "\n");
    return readerFormatEscapedInline(escaped).replace(/\n/g, "<br />");
  }

  /** Turn doc-color-ff0000 class tokens into an inline style (safe hex only). */
  function docInlineSpanOpenTag(classList) {
    var classes = String(classList || "")
      .split(/\s+/)
      .filter(Boolean);
    var colorHex = null;
    var i;
    for (i = 0; i < classes.length; i++) {
      var m = /^doc-color-([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(
        classes[i],
      );
      if (!m) continue;
      colorHex =
        m[1].length === 3
          ? m[1]
              .split("")
              .map(function (c) {
                return c + c;
              })
              .join("")
          : m[1].slice(0, 6);
      colorHex = colorHex.toLowerCase();
      break;
    }
    var tag = '<span class="' + classes.join(" ") + '"';
    if (colorHex) {
      tag += ' style="color:#' + colorHex + '"';
    }
    return tag + ">";
  }

  function formatBodyInline(block) {
    if (!hasPreservedInlineHtml(block)) {
      var escapedOnly = escapeHtml(block).replace(/\r\n/g, "\n");
      return readerFormatEscapedInline(escapedOnly).replace(/\n/g, "<br />");
    }
    PRESERVED_INLINE_CHUNK_RE.lastIndex = 0;
    var out = "";
    var last = 0;
    var m;
    var matched = false;
    while ((m = PRESERVED_INLINE_CHUNK_RE.exec(block))) {
      matched = true;
      var before = block.slice(last, m.index);
      if (before) {
        out += formatPreservedInner(before);
      }
      if (m[1] != null) {
        out +=
          docInlineSpanOpenTag(m[1]) + formatPreservedInner(m[2]) + "</span>";
      } else if (m[3] != null) {
        out += "<u>" + formatPreservedInner(m[3]) + "</u>";
      }
      last = m.index + m[0].length;
    }
    if (!matched) {
      var escapedFallback = escapeHtml(block).replace(/\r\n/g, "\n");
      return readerFormatEscapedInline(escapedFallback).replace(
        /\n/g,
        "<br />",
      );
    }
    var tail = block.slice(last);
    if (tail) {
      out += formatPreservedInner(tail);
    }
    return out;
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
    // Isolate scene-only lines that lack a blank line before/after.
    var normalized = String(markdown || "")
      .replace(/^(\[\[\s*scene\s*:[^\]]+\]\])[ \t]*$/gim, "\n$1\n")
      .replace(/\n{3,}/g, "\n\n");
    var blocks = normalized.split(/\n\n+/);
    var html = [];
    var chapterIndex = 0;
    function chapterHeading(level, trimmed) {
      var tag = level === 2 ? "h2" : "h3";
      var inner = hasPreservedInlineHtml(trimmed)
        ? formatBodyInline(trimmed)
        : readerFormatEscapedInline(escapeHtml(trimmed));
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
        if (getAiImagesEnabled() && isStoryScenesVisibleOnSite(story)) {
          html.push(readerSceneFigureHtml(story, sceneMatch[1]));
        }
        continue;
      }
      if (block.indexOf("### ") === 0) {
        html.push(chapterHeading(3, block.slice(4).trim()));
      } else if (block.indexOf("## ") === 0) {
        html.push(chapterHeading(2, block.slice(3).trim()));
      } else if (block.indexOf("# ") === 0) {
        html.push(chapterHeading(3, block.slice(2).trim()));
      } else if (/^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/.test(block)) {
        if (!getAiImagesEnabled()) {
          continue;
        }
        var im = block.match(/^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/);
        var iu = im && normalizeReaderHref(im[2].trim());
        if (iu && /^https?:\/\//i.test(iu)) {
          html.push(
            '<figure class="story-reader-md-image"><img src="' +
              escapeHtml(iu) +
              '" alt="' +
              escapeHtml((im[1] || "").trim()) +
              '" class="story-reader-md-image-img" loading="lazy" decoding="async"></figure>',
          );
        } else {
          html.push("<p>" + formatBodyInline(block) + "</p>");
        }
      } else if (/^\s*(?:[-*_]\s*)+$/.test(block)) {
        html.push('<hr class="story-reader-divider" />');
      } else {
        html.push("<p>" + formatBodyInline(block) + "</p>");
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
    setStoryReaderChapterHighlight(active);
    syncStoryReaderChapterHash(active);
    if (readerStory) {
      updateStoryReaderShareLinks(readerStory, active + 1);
    }
  }

  /**
   * Reader deep-link: #story/<id>/read or #story/<id>/read/<n> (1-based sidebar
   * chapter index). Uses replaceState so scroll sync does not re-fire applyHash.
   */
  function storyReaderHash(storyId, chapterOneBased) {
    var h = "#story/" + String(storyId) + "/read";
    if (
      typeof chapterOneBased === "number" &&
      isFinite(chapterOneBased) &&
      chapterOneBased >= 1
    ) {
      h += "/" + Math.floor(chapterOneBased);
    }
    return h;
  }

  function replaceStoryReaderHash(storyId, chapterOneBased) {
    var newHash = storyReaderHash(storyId, chapterOneBased);
    var cur = "#" + (location.hash || "").replace(/^#/, "");
    if (cur.toLowerCase() === newHash.toLowerCase()) return;
    try {
      history.replaceState(null, "", newHash);
    } catch (_e) {
      location.hash = newHash.replace(/^#/, "");
    }
  }

  function syncStoryReaderChapterHash(chapterIndex0) {
    if (suppressChapterHashSync) return;
    if (!readerStory || readerStory.id == null) return;
    if (
      typeof chapterIndex0 !== "number" ||
      !isFinite(chapterIndex0) ||
      chapterIndex0 < 0
    ) {
      return;
    }
    if (lastSyncedReaderChapter === chapterIndex0) return;
    var oneBased = chapterIndex0 + 1;
    var state = parseHash();
    // Keep bare #story/<id>/read while still on the first chapter unless the
    // URL already named a chapter (or the user jumped via the sidebar).
    if (
      state.readMode &&
      String(state.storyId) === String(readerStory.id) &&
      state.chapter == null &&
      oneBased === 1
    ) {
      lastSyncedReaderChapter = chapterIndex0;
      return;
    }
    lastSyncedReaderChapter = chapterIndex0;
    replaceStoryReaderHash(readerStory.id, oneBased);
  }

  function setStoryReaderChapterHighlight(activeIndex) {
    var i;
    for (i = 0; i < readerChapterBtns.length; i++) {
      var on = i === activeIndex;
      readerChapterBtns[i].classList.toggle("is-active", on);
      if (on) {
        readerChapterBtns[i].setAttribute("aria-current", "location");
      } else {
        readerChapterBtns[i].removeAttribute("aria-current");
      }
    }
  }

  function scrollStoryReaderToChapter(chapterOneBased, behavior) {
    if (!storyReaderScroll) return false;
    if (
      typeof chapterOneBased !== "number" ||
      !isFinite(chapterOneBased) ||
      chapterOneBased < 1
    ) {
      suppressChapterHashSync = true;
      storyReaderScroll.scrollTop = 0;
      setStoryReaderChapterHighlight(0);
      lastSyncedReaderChapter = 0;
      suppressChapterHashSync = false;
      return true;
    }
    if (!readerChapterHeads.length) return false;
    var idx = Math.floor(chapterOneBased) - 1;
    if (idx < 0) idx = 0;
    if (idx >= readerChapterHeads.length) idx = readerChapterHeads.length - 1;
    var head = readerChapterHeads[idx];
    if (!head) return false;
    suppressChapterHashSync = true;
    head.scrollIntoView({
      behavior: behavior || "auto",
      block: "start",
    });
    setStoryReaderChapterHighlight(idx);
    lastSyncedReaderChapter = idx;
    if (readerStory && readerStory.id != null) {
      replaceStoryReaderHash(readerStory.id, idx + 1);
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        suppressChapterHashSync = false;
        updateStoryReaderChapterHighlight();
      });
    });
    return true;
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
    lastSyncedReaderChapter = null;
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
      (function (head, chapterIndex0) {
        var li = document.createElement("li");
        var level = head.classList.contains("story-reader-chapter--h2")
          ? "h2"
          : "h3";
        li.className = "story-reader-chapters-item--" + level;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "story-reader-chapters-link";
        var chapterTitle = head.textContent || "";
        var chapterDateLabel = readerStory
          ? formatStoryChapterReleaseDateLabel(readerStory, chapterIndex0 + 1)
          : null;
        if (chapterDateLabel) {
          btn.innerHTML =
            '<span class="story-reader-chapters-link-label">' +
            escapeHtml(chapterTitle) +
            '</span><span class="story-reader-chapters-link-date">' +
            escapeHtml(chapterDateLabel) +
            "</span>";
        } else {
          btn.textContent = chapterTitle;
        }
        btn.addEventListener("click", function () {
          scrollStoryReaderToChapter(chapterIndex0 + 1, "smooth");
        });
        li.appendChild(btn);
        ul.appendChild(li);
        readerChapterBtns.push(btn);
      })(readerChapterHeads[i], i);
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

    var pending = pendingReaderChapter;
    pendingReaderChapter = null;
    if (pending == null) {
      var hashState = parseHash();
      if (
        hashState.readMode &&
        readerStory &&
        String(hashState.storyId) === String(readerStory.id) &&
        hashState.chapter != null
      ) {
        pending = hashState.chapter;
      }
    }
    if (pending != null) {
      scrollStoryReaderToChapter(pending, "auto");
    } else {
      updateStoryReaderChapterHighlight();
    }
  }

  /**
   * URL for social / chat apps: static share/<id>.html carries og:* tags (hash
   * reader URLs are invisible to servers). Opens the story reader via redirect.
   * Optional chapterOneBased uses share/<id>-<n>.html when configured in
   * story.chapterShares.
   */
  function storyChapterShareConfig(story, chapterOneBased) {
    if (
      !story ||
      !Array.isArray(story.chapterShares) ||
      typeof chapterOneBased !== "number" ||
      !isFinite(chapterOneBased) ||
      chapterOneBased < 1
    ) {
      return null;
    }
    var n = Math.floor(chapterOneBased);
    for (var i = 0; i < story.chapterShares.length; i++) {
      var cfg = story.chapterShares[i];
      if (cfg && cfg.chapter === n) return cfg;
    }
    return null;
  }

  function storyReaderSharePageUrl(storyId, chapterOneBased, story) {
    var prefix = location.pathname
      .replace(/\/index\.html?$/i, "")
      .replace(/\/$/, "");
    var fileName = String(storyId);
    if (story && storyChapterShareConfig(story, chapterOneBased)) {
      fileName += "-" + Math.floor(chapterOneBased);
    }
    var path = (prefix ? prefix + "/" : "") + "share/" + fileName + ".html";
    if (path.charAt(0) !== "/") path = "/" + path;
    return new URL(path, location.origin).href;
  }

  var shareCopiedTimer = null;

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        if (document.execCommand("copy")) resolve();
        else reject(new Error("copy failed"));
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  function flashShareCopied(btn) {
    btn.textContent = "Copied!";
    btn.classList.add("story-reader-share-btn--copied");
    if (shareCopiedTimer) clearTimeout(shareCopiedTimer);
    shareCopiedTimer = setTimeout(function () {
      btn.textContent = "Share";
      btn.classList.remove("story-reader-share-btn--copied");
      shareCopiedTimer = null;
    }, 2000);
  }

  function bindStoryReaderShare() {
    var btn = byId("story-reader-share");
    if (!btn || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", function () {
      var url = btn.getAttribute("data-share-url");
      if (!url) return;
      copyTextToClipboard(url)
        .then(function () {
          flashShareCopied(btn);
        })
        .catch(function () {});
    });
  }

  function updateStoryReaderShareLinks(story, chapterOneBased) {
    var btn = byId("story-reader-share");
    if (!btn) return;
    btn.setAttribute(
      "data-share-url",
      storyReaderSharePageUrl(story.id, chapterOneBased, story),
    );
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

    if (storyPasswordProtected(story)) {
      storyReaderStatus.hidden = true;
      storyReaderArticle.innerHTML = storyReaderUnlockFormHtml(story);
      bindStoryReaderUnlockForm(story);
      var unlockInput = byId("story-reader-unlock-input");
      if (unlockInput) unlockInput.focus();
      return;
    }

    var mdUrl = storyReaderMarkdownUrl(story);
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
        renderStoryReaderMarkdown(story, text);
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

  function flyoutCharactersSection(chars) {
    if (!chars || !chars.length) return "";
    var h =
      '<div class="flyout-section"><h3 class="flyout-section-title">Characters</h3><ul class="flyout-list flyout-list--with-actions">';
    for (var fi = 0; fi < chars.length; fi++) {
      var c = chars[fi];
      if (!c) continue;
      h +=
        "<li>" +
        '<button type="button" class="flyout-inline-link" data-character-id="' +
        escapeHtml(String(c.id)) +
        '">' +
        escapeHtml(c.name || "") +
        "</button>" +
        '<button type="button" class="flyout-connections-link" data-open-connections="' +
        escapeHtml(String(c.id)) +
        '" title="Open in Connections">Connections</button>' +
        "</li>";
    }
    return h + "</ul></div>";
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

  /**
   * Fires once when the reader shell opens (markdown may still be loading).
   * Disabled unless window.DATA_ANALYTICS.ingestUrl is set (see data/analytics.js).
   */
  function logStoryReaderView(story) {
    var cfg = window.DATA_ANALYTICS || {};
    var url = (cfg.ingestUrl || "").trim();
    if (!url || !story || story.id == null) return;
    var sid =
      typeof story.id === "number" ? story.id : parseInt(String(story.id), 10);
    if (!isFinite(sid)) return;
    var payload = JSON.stringify({ storyId: sid });
    try {
      fetch(url, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  function openStoryReader(story, chapterOneBased) {
    if (!story || !storyReaderEl) return;
    setFlyoutPanelOpen(false);

    if (
      typeof chapterOneBased === "number" &&
      isFinite(chapterOneBased) &&
      chapterOneBased >= 1
    ) {
      pendingReaderChapter = Math.floor(chapterOneBased);
    } else {
      pendingReaderChapter = null;
    }

    storyReaderTitle.textContent = story.title || "";
    var detailsId =
      story.detailsStoryId != null ? story.detailsStoryId : story.id;
    if (storyReaderDetails) {
      storyReaderDetails.setAttribute("data-details-story-id", String(detailsId));
    }
    updateStoryReaderShareLinks(
      story,
      pendingReaderChapter != null ? pendingReaderChapter : null,
    );

    storyReaderEl.setAttribute("aria-hidden", "false");
    storyReaderEl.classList.add("open");
    document.body.classList.add("story-reader-open");

    logStoryReaderView(story);
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
    var cls = "flyout-purchase-btn flyout-purchase-btn--" + escapeHtml(variant);
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
    var labelKey = vendor.variant === "kofi" ? "kofiLabel" : "amazonLabel";
    var cells = parts
      .map(function (p, i) {
        var url =
          typeof p[vendor.urlKey] === "string" ? p[vendor.urlKey].trim() : "";
        if (!url) return "";
        var n = typeof p.part === "number" && !isNaN(p.part) ? p.part : i + 1;
        var tooltip =
          vendor.variant === "amazon" && p.kofiUrl
            ? KOFI_PREFERENCE_TOOLTIP
            : null;
        var cellLabel =
          p[labelKey] || "Buy part " + n + " on " + vendor.label + "!";
        return purchasePartCell(url, cellLabel, vendor.variant, tooltip);
      })
      .join("");
    if (!cells) return "";
    return '<div class="flyout-purchase-grid">' + cells + "</div>";
  }

  function formatPurchasePartsFlyoutHtml(story) {
    var parts = story.purchaseParts;
    if (!parts || !parts.length) return "";
    var grids = PURCHASE_VENDORS.map(function (v) {
      return purchaseVendorGridHtml(parts, v);
    }).join("");
    if (!grids) return "";
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
    if (opts.disabled) {
      return (
        '<div class="flyout-full-story-wrap">' +
        '<span class="flyout-full-story-cta flyout-full-story-cta--disabled' +
        (opts.variant
          ? " flyout-full-story-cta--" + escapeHtml(opts.variant)
          : "") +
        '" aria-disabled="true"' +
        (opts.tooltip ? ' title="' + escapeHtml(opts.tooltip) + '"' : "") +
        ">" +
        escapeHtml(opts.label) +
        "</span></div>"
      );
    }
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
    var charsHtml = flyoutCharactersSection(chars);

    var releaseLabel = formatStoryReleaseDateLabel(story.releaseDate);
    var releaseHtml =
      releaseLabel !== null
        ? '<p class="flyout-release-date">Release date: <em>' +
          escapeHtml(releaseLabel) +
          "</em></p>"
        : "";
    var chapterReleasesHtml = formatStoryChapterReleasesFlyoutHtml(story);

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
    var brutalityHtml = formatBrutalityRatingFlyoutHtml(story);
    var coverHtml = "";
    if (getAiImagesEnabled()) {
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
    }
    flyoutBody.innerHTML =
      '<div class="flyout-story">' +
      '<h2 class="flyout-title">' +
      escapeHtml(story.title) +
      "</h2>" +
      coverHtml +
      '<div class="flyout-story-meta">' +
      '<p class="flyout-summary">' +
      escapeHtml(story.summary || "") +
      "</p>" +
      releaseHtml +
      chapterReleasesHtml +
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
    var pics =
      character.profilePictures && character.profilePictures.length
        ? character.profilePictures
        : [PLACEHOLDER_CHAR];
    var picsHtml =
      '<div class="flyout-profiles">' +
      pics
        .map(function (src, idx) {
          return (
            '<div class="flyout-profile-wrap">' +
            '<button type="button" class="flyout-profile-zoom" aria-label="' +
            escapeHtml(
              (character.name || "Character") +
                " — enlarge portrait" +
                (pics.length > 1 ? " (" + (idx + 1) + ")" : ""),
            ) +
            '" data-zoom-character="' +
            escapeHtml(character.id) +
            '" data-profile-index="' +
            idx +
            '">' +
            imgHtml({
              src: src,
              alt: "",
              className: "flyout-profile-img",
              placeholder: PLACEHOLDER_CHAR,
              extras: 'loading="lazy" decoding="async"',
            }) +
            "</button></div>"
          );
        })
        .join("") +
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

    var metaHtml = "";
    if (character.entityType === "faction") {
      metaHtml = '<p class="flyout-character-meta">Faction</p>';
    } else {
      var genderSymbol = character.gender === "F" ? "\u2640" : "\u2642";
      metaHtml = '<p class="flyout-character-meta">' + escapeHtml(genderSymbol);
      if (
        character.gender === "F" &&
        typeof character.testiclesKilled === "number"
      ) {
        metaHtml += " &middot; Testicles killed: " + character.testiclesKilled;
      }
      metaHtml += "</p>";
    }

    flyoutBody.innerHTML =
      picsHtml +
      '<h2 class="flyout-title">' +
      escapeHtml(character.name) +
      "</h2>" +
      metaHtml +
      '<p class="flyout-summary">' +
      escapeHtml(character.bio || "") +
      "</p>" +
      '<div class="flyout-connections-cta-wrap">' +
      '<button type="button" class="flyout-connections-cta" data-open-connections="' +
      escapeHtml(character.id) +
      '">Open in Connections</button>' +
      "</div>" +
      storiesHtml;

    setFlyoutPanelOpen(true);
  }

  function closeFlyout() {
    var state = parseHash();
    if (state.readMode) {
      location.hash = "stories";
      return;
    }
    if (state.characterId) {
      location.hash = state.tab;
      return;
    }
    if (state.storyId !== undefined) {
      var story = getStoryById(state.storyId);
      if (story && storyIsReadable(story)) {
        location.hash = "story/" + state.storyId + "/read";
        return;
      }
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
      if (
        storyRead &&
        (isStoryVisibleInCatalog(storyRead) ||
          storyPasswordProtected(storyRead))
      ) {
        var readerOpen =
          storyReaderEl &&
          storyReaderEl.classList.contains("open") &&
          readerStory &&
          String(readerStory.id) === String(storyRead.id);
        if (
          readerOpen &&
          !storyPasswordProtected(storyRead) &&
          readerChapterHeads.length
        ) {
          scrollStoryReaderToChapter(state.chapter, "smooth");
          return;
        }
        openStoryReader(storyRead, state.chapter);
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
      if (story && storyPasswordProtected(story) && story.catalogHidden) {
        openStoryReader(story, state.chapter);
      } else if (story && isStoryVisibleInCatalog(story)) {
        openStoryFlyout(story);
      } else {
        closeFlyout();
      }
    } else {
      setFlyoutPanelOpen(false);
      if (state.scenesStoryId !== undefined) {
        openScenesAccordionFor(state.scenesStoryId);
      }
      if (state.connectionsCharacterId) {
        var fromQuery = !!connectionsCharacterFromQuery();
        focusConnectionsCharacter(state.connectionsCharacterId, {
          updateHash: fromQuery,
        });
      }
    }
  }

  function bindStoryGridClick() {
    var storiesGrid = byId("stories-grid");
    if (!storiesGrid) return;
    storiesGrid.addEventListener("click", function (e) {
      if (handleCoverFlipClick(e)) return;
      if (e.target.closest(".story-card-action")) return;
      var card = e.target.closest(".story-card");
      if (!card) return;
      if (!getAiImagesEnabled()) return;
      var id = card.getAttribute("data-story");
      if (!id) return;
      var story = getStoryById(id);
      if (!story) return;
      var href = storyCatalogHref(story);
      location.hash = href.charAt(0) === "#" ? href.slice(1) : href;
    });
    bindCoverFlipKeydown(storiesGrid);
  }

  function bindCharacterGridClick() {
    var charactersGrid = byId("characters-grid");
    if (charactersGrid) {
      charactersGrid.addEventListener("click", function (e) {
        var zoomBtn = e.target.closest(".character-avatar-zoom");
        if (zoomBtn && charactersGrid.contains(zoomBtn)) {
          var zid = zoomBtn.getAttribute("data-character-id");
          var ch = zid ? getCharacterById(zid) : null;
          if (ch) {
            e.preventDefault();
            e.stopPropagation();
            openCharacterProfileLightbox(ch, 0);
          }
          return;
        }
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

  function mergeAndreaScenesIntoStoriesList(list) {
    var out = list && list.slice ? list.slice() : [];
    var s43i = -1;
    var s44 = null;
    for (var i = 0; i < out.length; i++) {
      if (out[i].id === 43) s43i = i;
      if (out[i].id === 44) s44 = out[i];
    }
    if (s43i >= 0) {
      var base = out[s43i];
      out[s43i] = Object.assign({}, base, {
        scenes: [].concat(base.scenes || [], (s44 && s44.scenes) || []),
      });
    }
    return out;
  }

  function initLocalAndreaPage() {
    var article = byId("local-andrea-article");
    var status = byId("local-andrea-status");
    var errBox = byId("local-andrea-error");
    var errMsg = byId("local-andrea-error-msg");
    if (!article) return;

    stories = mergeAndreaScenesIntoStoriesList(window.DATA_STORIES || []);

    function fail(msg) {
      if (status) status.hidden = true;
      if (errBox && errMsg) {
        errBox.hidden = false;
        errMsg.textContent = msg;
      }
    }

    fetch(LOCAL_DIST_MARKER_URL, { credentials: "omit" })
      .then(function (r) {
        if (!r.ok) throw new Error("no marker");
        return fetch(LOCAL_ANDREA_STORY_MD_URL, { credentials: "omit" });
      })
      .then(function (r) {
        if (!r.ok) throw new Error("no md");
        return r.text();
      })
      .then(function (md) {
        var meta = getStoryById(43);
        if (!meta) {
          fail("Missing catalog story id 43 (Andrea and Lucas: Part 1).");
          return;
        }
        article.innerHTML = storyMarkdownToSafeHtml(md, meta);
        bindSceneFigureZoom(article);
        initSceneLightbox();
        if (status) status.hidden = true;
      })
      .catch(function () {
        fail(
          "This page only works locally after you run npm run sync:andrea-complete, then serve the site from the repo root (e.g. npm start). The dist/ folder is gitignored and is not on production.",
        );
      });

    document.addEventListener("keydown", function (e) {
      var lbOpen = sceneLightbox && sceneLightbox.classList.contains("open");
      if (lbOpen && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        sceneStepLightbox(e.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (e.key !== "Escape") return;
      if (lbOpen) {
        closeSceneLightbox();
      }
    });
  }

  function init(data) {
    characters = data.characters || [];
    normalizeCharacterProfilePictures(characters);
    stories = data.stories || [];
    var normalizedCaptions = normalizeCaptionSections(data.captions);
    captions = normalizedCaptions.captions;
    captionSections = normalizedCaptions.sections;
    fanart = data.fanart || [];
    pendingOtherAuthors = data.otherAuthors || [];

    try {
      localStorage.removeItem("connectionsBetaUnlocked");
    } catch (e) {}

    initTabs();
    initCharactersGrid();
    initStoryFilters();
    bindAiImagesToggle();
    renderStoriesGrid();
    initSceneLightbox();
    bindStoryGridClick();
    bindCharacterGridClick();

    if (flyoutBackdrop) flyoutBackdrop.addEventListener("click", closeFlyout);
    if (flyoutClose) flyoutClose.addEventListener("click", closeFlyout);
    bindStoryKofiPrefTipUi();
    if (flyoutBody) {
      flyoutBody.addEventListener("click", function (e) {
        if (handleCoverFlipClick(e)) return;
        var openConn =
          e.target &&
          e.target.closest &&
          e.target.closest("[data-open-connections]");
        if (openConn && flyoutBody.contains(openConn)) {
          e.preventDefault();
          openCharacterInConnections(
            openConn.getAttribute("data-open-connections"),
          );
          return;
        }
        var pz =
          e.target &&
          e.target.closest &&
          e.target.closest(".flyout-profile-zoom");
        if (pz && flyoutBody.contains(pz)) {
          var cid = pz.getAttribute("data-zoom-character");
          var idxRaw = pz.getAttribute("data-profile-index");
          var ch = cid ? getCharacterById(cid) : null;
          var idx = typeof idxRaw === "string" ? parseInt(idxRaw, 10) : NaN;
          if (ch && !isNaN(idx) && idx >= 0) {
            e.preventDefault();
            openCharacterProfileLightbox(ch, idx);
            return;
          }
        }
        var btn = e.target.closest(".flyout-inline-link");
        if (!btn) return;
        var charId = btn.getAttribute("data-character-id");
        if (charId) {
          location.hash = "character/" + charId;
          return;
        }
        var sid = btn.getAttribute("data-story-id");
        if (sid) {
          location.hash = storyCatalogHref(getStoryById(sid)).slice(1);
        }
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
    if (storyReaderDetails) {
      storyReaderDetails.addEventListener("click", function () {
        var detailsId = storyReaderDetails.getAttribute("data-details-story-id");
        if (!detailsId && readerStory) {
          detailsId =
            readerStory.detailsStoryId != null
              ? readerStory.detailsStoryId
              : readerStory.id;
        }
        var detailsStory = detailsId != null ? getStoryById(detailsId) : null;
        if (detailsStory) openStoryFlyout(detailsStory);
      });
    }
    bindStoryReaderShare();
    document.addEventListener("keydown", function (e) {
      var lbOpen = sceneLightbox && sceneLightbox.classList.contains("open");
      if (lbOpen && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        sceneStepLightbox(e.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (e.key !== "Escape") return;
      if (lbOpen) {
        closeSceneLightbox();
        return;
      }
      if (flyout && flyout.classList.contains("open")) {
        closeFlyout();
        return;
      }
      var h = parseHash();
      if (h.readMode) {
        location.hash = "stories";
      }
    });

    window.addEventListener("hashchange", applyHash);
    applyHash();
    checkLocalDistMarker().then(function (ok) {
      if (ok) {
        document.documentElement.classList.add("has-local-dist");
        loadStoryCatalogRatings();
      } else {
        document.documentElement.classList.remove("has-local-dist");
        if (parseHash().tab === "ratings") location.hash = "stories";
      }
      applyHash();
    });
  }

  if (document.body && document.body.classList.contains("preun-local-andrea")) {
    initLocalAndreaPage();
  } else {
    init(window.DATA_SOURCE || { characters: [], stories: [] });
  }
})();
