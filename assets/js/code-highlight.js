(function () {
  var TYPE_RE = /^[UAFTEIS][A-Z]/;
  var names = document.querySelectorAll(".post-content .highlight .n");
  if (!names.length) return;

  names.forEach(function (el) {
    var text = el.textContent;
    if (TYPE_RE.test(text)) {
      el.classList.add("syn-type");
      return;
    }
    var next = el.nextElementSibling;
    if (next && next.classList.contains("p") && next.textContent.charAt(0) === "(") {
      el.classList.add("syn-func");
    }
  });
})();
