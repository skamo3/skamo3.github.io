(function () {
  var THRESHOLD = 200;
  var pres = document.querySelectorAll(".post-content pre:not(.mermaid)");
  if (!pres.length) return;

  pres.forEach(function (pre) {
    if (pre.scrollHeight <= THRESHOLD + 20) return;

    pre.classList.add("code-collapsible", "is-collapsed");
    var hint = document.createElement("div");
    hint.className = "code-expand-hint";
    hint.textContent = "클릭하여 펼치기";
    pre.appendChild(hint);

    var downX = 0;
    var downY = 0;
    pre.addEventListener("mousedown", function (e) {
      downX = e.clientX;
      downY = e.clientY;
    });
    pre.addEventListener("click", function (e) {
      var moved = Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4;
      var hasSelection = window.getSelection().toString().length > 0;
      if (moved || hasSelection) return;
      var collapsed = pre.classList.toggle("is-collapsed");
      hint.textContent = collapsed ? "클릭하여 펼치기" : "클릭하여 접기";
    });
  });
})();
