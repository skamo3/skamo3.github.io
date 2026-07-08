(function () {
  var raw = new URLSearchParams(window.location.search).get("highlight");
  if (!raw) return;
  var slugs = raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  if (!slugs.length) return;

  document.querySelectorAll(".project-grid").forEach(function (grid) {
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".project-card"));
    var matched = [];
    cards.forEach(function (card) {
      var slug = card.getAttribute("data-slug");
      var idx = slugs.indexOf(slug);
      if (idx !== -1) {
        card.classList.add("is-highlighted");
        matched.push({ card: card, idx: idx });
      }
    });
    matched.sort(function (a, b) { return b.idx - a.idx; });
    matched.forEach(function (m) { grid.insertBefore(m.card, grid.firstChild); });
  });
})();
