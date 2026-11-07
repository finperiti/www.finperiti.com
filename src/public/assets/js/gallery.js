/* finperiti — photo gallery (lightbox) for news cards. Opens from [data-gallery-open]; photos listed in [data-gallery]. */
(function () {
  var lists = document.querySelectorAll("[data-gallery]");
  if (!lists.length) return;

  lists.forEach(function (list) {
    var card = list.closest(".ms-card") || list.parentNode;
    var photos = [].map.call(list.querySelectorAll("li"), function (li) {
      return { src: li.getAttribute("data-src"), alt: li.getAttribute("data-alt") || "" };
    });
    var box, img, cap, count, thumbs, current = 0, lastFocus, startX = null;

    function build() {
      box = document.createElement("div");
      box.className = "gal";
      box.hidden = true;
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-label", list.getAttribute("data-gallery") || "Photo gallery");
      box.innerHTML =
        '<div class="gal__bar"><p class="gal__count" aria-live="polite"></p>' +
        '<button type="button" class="gal__close" aria-label="Close gallery">&times;</button></div>' +
        '<div class="gal__stage">' +
        '<button type="button" class="gal__nav gal__nav--prev" aria-label="Previous photo">&#8249;</button>' +
        '<figure class="gal__fig"><img class="gal__img" alt=""><figcaption class="gal__cap"></figcaption></figure>' +
        '<button type="button" class="gal__nav gal__nav--next" aria-label="Next photo">&#8250;</button></div>' +
        '<div class="gal__thumbs" role="group" aria-label="All photos"></div>';
      document.body.appendChild(box);
      img = box.querySelector(".gal__img");
      cap = box.querySelector(".gal__cap");
      count = box.querySelector(".gal__count");
      thumbs = box.querySelector(".gal__thumbs");
      photos.forEach(function (p, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "gal__thumb";
        b.setAttribute("aria-label", "Photo " + (i + 1) + ": " + p.alt);
        b.innerHTML = '<img alt="" loading="lazy">';
        b.querySelector("img").src = p.src;
        b.addEventListener("click", function () { show(i); });
        thumbs.appendChild(b);
      });
      box.querySelector(".gal__close").addEventListener("click", close);
      box.querySelector(".gal__nav--prev").addEventListener("click", function () { show(current - 1); });
      box.querySelector(".gal__nav--next").addEventListener("click", function () { show(current + 1); });
      box.addEventListener("click", function (e) { if (e.target === box || e.target.classList.contains("gal__stage")) close(); });
      box.addEventListener("keydown", function (e) {
        if (e.key === "Escape") close();
        else if (e.key === "ArrowLeft") show(current - 1);
        else if (e.key === "ArrowRight") show(current + 1);
        else if (e.key === "Tab") {
          var f = box.querySelectorAll("button"), first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          return;
        } else return;
        e.preventDefault();
      });
      // Swipe left and right on phones.
      img.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
      img.addEventListener("touchend", function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
        startX = null;
      });
    }
    function show(i) {
      current = (i + photos.length) % photos.length;
      var p = photos[current];
      img.src = p.src;
      img.alt = p.alt;
      cap.textContent = p.alt;
      count.textContent = (current + 1) + " / " + photos.length;
      [].forEach.call(thumbs.children, function (t, k) {
        t.classList.toggle("is-current", k === current);
        t.setAttribute("aria-current", k === current ? "true" : "false");
      });
      var t = thumbs.children[current];
      if (t && t.scrollIntoView) t.scrollIntoView({ block: "nearest", inline: "center" });
    }
    function open(i) {
      if (!box) build();
      lastFocus = document.activeElement;
      box.hidden = false;
      document.documentElement.classList.add("gal-open");
      show(i || 0);
      box.querySelector(".gal__close").focus();
    }
    function close() {
      box.hidden = true;
      document.documentElement.classList.remove("gal-open");
      if (lastFocus) lastFocus.focus();
    }
    card.querySelectorAll("[data-gallery-open]").forEach(function (b) {
      b.addEventListener("click", function () { open(+(b.getAttribute("data-gallery-open") || 0)); });
    });
  });
})();
