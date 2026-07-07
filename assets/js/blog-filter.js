(function () {
  var tabs = document.querySelectorAll(".filter-tab");
  var items = document.querySelectorAll(".post-item");
  if (!tabs.length || !items.length) return;

  function applyFilter(cat) {
    tabs.forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-cat") === cat);
    });
    items.forEach(function (item) {
      var match = cat === "all" || item.getAttribute("data-cat") === cat;
      item.classList.toggle("is-hidden", !match);
    });
  }

  var initialCat = new URLSearchParams(window.location.search).get("cat") || "all";
  if (!document.querySelector('.filter-tab[data-cat="' + initialCat + '"]')) {
    initialCat = "all";
  }
  applyFilter(initialCat);

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var cat = tab.getAttribute("data-cat");
      applyFilter(cat);
      var url = new URL(window.location.href);
      if (cat === "all") {
        url.searchParams.delete("cat");
      } else {
        url.searchParams.set("cat", cat);
      }
      history.replaceState(null, "", url);
    });
  });
})();
