(function () {
  var THRESHOLD = 200;

  function setup() {
    var pres = document.querySelectorAll(".post-content pre:not(.mermaid)");
    if (!pres.length) return;

    pres.forEach(function (pre) {
      // 마크다운에서 {: .no-collapse} 를 붙인 블록은 항상 펼쳐둔다
      if (pre.closest(".no-collapse")) return;
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
  }

  // 웹폰트 로드 전에 높이를 재면 실제보다 크게 나와서
  // 짧은 블록까지 접기 대상이 된다. 폰트가 준비된 뒤에 측정한다.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(setup);
  } else {
    window.addEventListener("load", setup);
  }
})();
