/**
 * Product image lightbox — same interaction model as the story-site scene lightbox.
 */
(function () {
  var lightbox = document.getElementById("scene-lightbox");
  var panel = document.getElementById("scene-lightbox-panel");
  var img = document.getElementById("scene-lightbox-img");
  var caption = document.getElementById("scene-lightbox-caption");
  var closeBtn = document.getElementById("scene-lightbox-close");
  var prevBtn = document.getElementById("scene-lightbox-prev");
  var nextBtn = document.getElementById("scene-lightbox-next");

  var returnFocus = null;
  var slides = [];
  var index = 0;

  function setOpen(on) {
    if (!lightbox) return;
    lightbox.setAttribute("aria-hidden", on ? "false" : "true");
    lightbox.classList.toggle("open", on);
    document.body.classList.toggle("scene-lightbox-open", on);
    if (!on && returnFocus && returnFocus.focus) {
      try {
        returnFocus.focus();
      } catch (_e) {}
      returnFocus = null;
    }
    if (on && closeBtn && closeBtn.focus) {
      try {
        closeBtn.focus();
      } catch (_e) {}
    }
  }

  function closeLightbox() {
    slides = [];
    index = 0;
    setOpen(false);
  }

  function updateNav() {
    var n = slides.length;
    var i = index;
    if (prevBtn) {
      prevBtn.setAttribute("aria-label", "Previous image");
      var hidePrev = n <= 1 || i <= 0;
      prevBtn.hidden = hidePrev;
      prevBtn.disabled = hidePrev;
    }
    if (nextBtn) {
      nextBtn.setAttribute("aria-label", "Next image");
      var hideNext = n <= 1 || i >= n - 1;
      nextBtn.hidden = hideNext;
      nextBtn.disabled = hideNext;
    }
  }

  function applySlide() {
    if (!img || !slides.length) return;
    var slide = slides[index];
    if (!slide) return;
    img.src = slide.path;
    img.alt = slide.alt || "";
    var capTrim = slide.caption != null ? String(slide.caption).trim() : "";
    if (panel) {
      var n = slides.length;
      var pos = index + 1;
      var ariaBase = capTrim || slide.alt || "Product image";
      var label = n > 1 ? ariaBase + " (" + pos + " of " + n + ")" : ariaBase;
      panel.setAttribute("aria-label", label);
    }
    if (caption) {
      if (capTrim) {
        caption.textContent = capTrim;
        caption.hidden = false;
      } else {
        caption.textContent = "";
        caption.hidden = true;
      }
    }
    updateNav();
  }

  function stepLightbox(delta) {
    var n = slides.length;
    if (n <= 1) return;
    var next = index + delta;
    if (next < 0 || next >= n) return;
    index = next;
    applySlide();
  }

  function openLightbox(productSlides, startIndex, productName) {
    if (!img || !lightbox || !productSlides.length) return;
    returnFocus = document.activeElement;
    slides = productSlides.map(function (s) {
      return {
        path: s.path,
        caption: s.caption || "",
        alt: s.caption || productName || "Product image",
      };
    });
    var i =
      typeof startIndex === "number" && !isNaN(startIndex)
        ? Math.max(0, Math.min(slides.length - 1, startIndex))
        : 0;
    index = i;
    applySlide();
    setOpen(true);
  }

  function bindProductZoom(root) {
    if (!root || root._productZoomBound) return;
    root._productZoomBound = true;
    root.addEventListener("click", function (e) {
      var fig =
        e.target &&
        e.target.closest &&
        e.target.closest(".oe-card__media--zoomable");
      if (!fig || !root.contains(fig)) return;
      var raw = fig.getAttribute("data-product-images");
      if (!raw) return;
      var productSlides;
      try {
        productSlides = JSON.parse(raw);
      } catch (_e) {
        return;
      }
      if (!productSlides.length) return;
      var startRaw = fig.getAttribute("data-image-index");
      var startIndex = startRaw != null ? parseInt(startRaw, 10) : 0;
      openLightbox(
        productSlides,
        isNaN(startIndex) ? 0 : startIndex,
        fig.getAttribute("data-product-name") || "",
      );
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var fig =
        e.target &&
        e.target.closest &&
        e.target.closest(".oe-card__media--zoomable");
      if (!fig || !root.contains(fig) || fig !== e.target) return;
      var raw = fig.getAttribute("data-product-images");
      if (!raw) return;
      var productSlides;
      try {
        productSlides = JSON.parse(raw);
      } catch (_e) {
        return;
      }
      if (!productSlides.length) return;
      e.preventDefault();
      openLightbox(
        productSlides,
        0,
        fig.getAttribute("data-product-name") || "",
      );
    });
  }

  function initLightbox() {
    if (!lightbox || lightbox._productLightboxBound) return;
    lightbox._productLightboxBound = true;
    bindProductZoom(document.getElementById("oe-product-grid"));
    lightbox.addEventListener("click", closeLightbox);
    if (panel) {
      panel.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        closeLightbox();
      });
    }
    if (prevBtn) {
      prevBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        stepLightbox(-1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        stepLightbox(1);
      });
    }
    document.addEventListener("keydown", function (e) {
      var open = lightbox && lightbox.classList.contains("open");
      if (open && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        stepLightbox(e.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (open && e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      }
    });
  }

  window.OE_INIT_PRODUCT_LIGHTBOX = initLightbox;
})();
