document.querySelectorAll(".th-item").forEach(function (item) {
  var tooltip = item.querySelector(".th-tooltip");
  if (!tooltip) return;

  function show() {
    var r = item.getBoundingClientRect();
    var tooltipHeight = tooltip.offsetHeight || 260;
    var fitsAbove = r.top - tooltipHeight - 10 >= 0;
    tooltip.style.left = r.left + r.width / 2 + "px";
    if (fitsAbove) {
      tooltip.style.top = r.top + "px";
      tooltip.classList.remove("below");
    } else {
      tooltip.style.top = r.bottom + "px";
      tooltip.classList.add("below");
    }
    tooltip.classList.add("is-visible");
  }

  function hide() {
    tooltip.classList.remove("is-visible");
  }

  item.addEventListener("mouseenter", show);
  item.addEventListener("mouseleave", hide);
  item.addEventListener("focus", show);
  item.addEventListener("blur", hide);
});
