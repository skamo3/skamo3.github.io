(function () {
  var modal = document.getElementById("project-modal");
  if (!modal) return;

  var backdrop = modal.querySelector(".modal-backdrop");
  var closeBtn = modal.querySelector(".modal-close");
  var body = modal.querySelector(".modal-body");
  var lastTrigger = null;

  function showModal() {
    modal.hidden = false;
    document.body.classList.add("modal-open");
    modal.querySelector(".modal-panel").scrollTop = 0;
    closeBtn.focus();
  }

  function hideModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    body.innerHTML = "";
    if (lastTrigger) lastTrigger.focus();
  }

  function openModal(url, triggerEl) {
    lastTrigger = triggerEl || null;
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("fetch failed");
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var detail = doc.querySelector(".project-detail");
        if (!detail) throw new Error("no .project-detail in response");
        body.innerHTML = detail.innerHTML;
        if (window.applyProjectSectionIndent) window.applyProjectSectionIndent(body);
        history.pushState({ projectModal: true }, "", url);
        showModal();
      })
      .catch(function () {
        window.location.href = url;
      });
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest(".js-project-card");
    if (!link) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openModal(link.href, link);
  });

  backdrop.addEventListener("click", function () {
    history.back();
  });
  closeBtn.addEventListener("click", function () {
    history.back();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) history.back();
  });
  window.addEventListener("popstate", function () {
    hideModal();
  });
})();
