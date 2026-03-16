(function () {
  var PLACEHOLDER_COVER = "assets/covers/placeholder.svg";
  var PLACEHOLDER_CHAR = "assets/characters/placeholder.svg";

  var characters = [];
  var stories = [];

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
      return s.id === id;
    })[0];
  }

  function renderStoriesGrid() {
    var grid = byId("stories-grid");
    if (!grid) return;
    var sorted = stories.slice().sort(function (a, b) {
      return (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
      });
    });
    grid.innerHTML = "";
    sorted.forEach(function (s) {
      var card = document.createElement("article");
      card.className = "story-card";
      card.setAttribute("data-story", s.id);
      card.innerHTML =
        '<div class="story-cover-wrap">' +
        '<img src="' +
        (s.cover || PLACEHOLDER_COVER) +
        '" alt="' +
        escapeHtml(s.title) +
        '" class="story-cover" onerror="this.src=\'' +
        PLACEHOLDER_COVER +
        "'\">" +
        "</div>" +
        '<span class="story-card-title">' +
        escapeHtml(s.title) +
        "</span>";
      grid.appendChild(card);
    });
  }

  // Tab switching with URL hash (#stories, #characters, #about, #other-authors)
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

  function getTabFromHash() {
    var hash = (location.hash || "").replace(/^#/, "").toLowerCase();
    return TAB_IDS.indexOf(hash) !== -1 ? hash : "stories";
  }

  function initTabs() {
    var panels = qsAll(".panel");
    var tabs = qsAll(".tab");

    // Initial tab from URL
    showTab(getTabFromHash());

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function (e) {
        e.preventDefault();
        var name = tab.getAttribute("data-tab");
        showTab(name);
        location.hash = name;
      });
    });

    window.addEventListener("hashchange", function () {
      showTab(getTabFromHash());
    });
  }

  // Build characters grid
  function initCharactersGrid() {
    var charactersGrid = byId("characters-grid");
    if (!charactersGrid || !characters.length) return;
    charactersGrid.innerHTML = "";
    var sorted = characters.slice().sort(function (a, b) {
      return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
    });
    sorted.forEach(function (c) {
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
      charactersGrid.appendChild(card);
    });
  }

  // Flyout: one panel, two modes
  var flyout = byId("flyout");
  var flyoutBackdrop = byId("flyout-backdrop");
  var flyoutClose = byId("flyout-close");
  var flyoutBody = byId("flyout-body");

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
    var linksHtml = '<div class="flyout-links">';
    if (story.driveUrl) {
      linksHtml +=
        '<a href="' +
        escapeHtml(story.driveUrl) +
        '" target="_blank" rel="noopener noreferrer" class="flyout-link">Google Drive</a>';
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

    flyoutBody.innerHTML =
      '<div class="flyout-mode flyout-mode-story">' +
      '<h2 class="flyout-title">' +
      escapeHtml(story.title) +
      "</h2>" +
      '<p class="flyout-summary">' +
      escapeHtml(story.summary || "") +
      "</p>" +
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
        openCharacterFlyout(getCharacterById(id));
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
        var id = parseInt(this.getAttribute("data-story-id"), 10);
        openStoryFlyout(getStoryById(id));
      });
    }
  }

  function closeFlyout() {
    flyout.setAttribute("aria-hidden", "true");
    flyout.classList.remove("open");
    document.body.classList.remove("flyout-open");
  }

  function bindStoryGridClick() {
    var storiesGrid = byId("stories-grid");
    if (storiesGrid) {
      storiesGrid.addEventListener("click", function (e) {
        var card = e.target.closest(".story-card");
        if (!card) return;
        var id = parseInt(card.getAttribute("data-story"), 10);
        openStoryFlyout(getStoryById(id));
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
        openCharacterFlyout(getCharacterById(id));
      });
    }
  }

  function init(data) {
    characters = data.characters || [];
    stories = data.stories || [];

    initTabs();
    initCharactersGrid();
    renderStoriesGrid();
    bindStoryGridClick();
    bindCharacterGridClick();

    if (flyoutBackdrop) flyoutBackdrop.addEventListener("click", closeFlyout);
    if (flyoutClose) flyoutClose.addEventListener("click", closeFlyout);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && flyout.classList.contains("open"))
        closeFlyout();
    });
  }

  init(window.DATA_SOURCE || { characters: [], stories: [] });
})();
