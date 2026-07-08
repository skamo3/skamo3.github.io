(function () {
  var query = new URLSearchParams(window.location.search);
  var shouldShowCompanyProjects = query.get("company") === "1";
  if (!shouldShowCompanyProjects) return;

  document.querySelectorAll("[data-company-projects]").forEach(function (section) {
    section.hidden = false;
  });
})();
