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

  // 모달 내부 앵커 링크는 해시 네비게이션(popstate로 모달이 닫힘) 대신
  // 모달 패널 안에서 직접 스크롤한다.
  body.addEventListener("click", function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    e.preventDefault();
    var id = link.getAttribute("href").slice(1);
    try {
      id = decodeURIComponent(id);
    } catch (err) {}
    var target = body.querySelector('[id="' + id.replace(/"/g, '\\"') + '"]');
    if (!target) return;
    var panel = modal.querySelector(".modal-panel");
    var top =
      target.getBoundingClientRect().top -
      panel.getBoundingClientRect().top +
      panel.scrollTop -
      16;
    // smooth 스크롤은 렌더링이 멈춘 탭에서 진행되지 않아 즉시 이동으로 처리
    panel.scrollTop = top;
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
