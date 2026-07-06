(function () {
  var HEADING_LEVEL = { H1: 1, H2: 2, H3: 3 };

  function applyIndent(root) {
    var scope = root || document;
    var body = scope.querySelector(".project-body");
    if (!body) return;

    var level = 0;
    for (var i = 0; i < body.children.length; i++) {
      var el = body.children[i];
      var headingLevel = HEADING_LEVEL[el.tagName];
      if (headingLevel) {
        level = headingLevel;
        continue;
      }
      el.classList.remove("indent-1", "indent-2", "indent-3");
      if (level > 0) el.classList.add("indent-" + level);
    }
  }

  window.applyProjectSectionIndent = applyIndent;
  document.addEventListener("DOMContentLoaded", function () {
    applyIndent();
  });
})();
