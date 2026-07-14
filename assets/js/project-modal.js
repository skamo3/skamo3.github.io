(function () {
  var modal = document.getElementById("project-modal");
  if (!modal) return;

  var backdrop = modal.querySelector(".modal-backdrop");
  var closeBtn = modal.querySelector(".modal-close");
  var expandBtn = modal.querySelector(".modal-expand");
  var body = modal.querySelector(".modal-body");
  var panel = modal.querySelector(".modal-panel");
  var topbar = modal.querySelector(".modal-topbar");
  var lastTrigger = null;
  // 모달이 히스토리에 쌓은 엔트리 수. 닫을 때 한 번에 전부 되돌린다.
  var depth = 0;
  // 펼치기: 모달 히스토리를 되돌린 뒤 이동할 standalone 페이지 URL
  var pendingExpandUrl = null;

  function showModal() {
    modal.hidden = false;
    document.body.classList.add("modal-open");
    panel.scrollTop = 0;
    closeBtn.focus();
  }

  function hideModal() {
    depth = 0;
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    body.innerHTML = "";
    if (lastTrigger) lastTrigger.focus();
  }

  function loadProject(url, onLoaded) {
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
        showModal();
        if (onLoaded) onLoaded();
      })
      .catch(function () {
        window.location.href = url;
      });
  }

  function openModal(url, triggerEl) {
    lastTrigger = triggerEl || null;
    loadProject(url, function () {
      depth = 1;
      history.pushState({ projectModal: true, idx: 1, scrollTop: 0 }, "", url);
    });
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest(".js-project-card");
    if (!link) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openModal(link.href, link);
  });

  // 모달 내부 앵커 링크: 브라우저 해시 네비게이션(popstate로 모달이 닫힘) 대신
  // 히스토리 엔트리를 직접 쌓고 모달 패널을 스크롤한다.
  // 뒤로가기 하면 popstate에서 이전 스크롤 위치(목차 등)로 복원된다.
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
    // sticky 상단바에 가려지지 않도록 상단바 높이만큼 여유를 둔다
    var offset = (topbar ? topbar.offsetHeight : 0) + 12;
    var top =
      target.getBoundingClientRect().top -
      panel.getBoundingClientRect().top +
      panel.scrollTop -
      offset;
    if (Math.abs(panel.scrollTop - top) < 1) return;
    // 현재 위치를 현재 엔트리에 기록해두고 새 엔트리를 쌓는다.
    history.replaceState(
      { projectModal: true, idx: depth, scrollTop: panel.scrollTop },
      ""
    );
    depth += 1;
    history.pushState(
      { projectModal: true, idx: depth, scrollTop: top },
      "",
      "#" + link.getAttribute("href").slice(1)
    );
    // smooth 스크롤은 렌더링이 멈춘 탭에서 진행되지 않아 즉시 이동으로 처리
    panel.scrollTop = top;
  });

  function requestClose() {
    history.go(-(depth > 0 ? depth : 1));
  }

  backdrop.addEventListener("click", requestClose);
  closeBtn.addEventListener("click", requestClose);
  if (expandBtn) {
    // 모달이 쌓은 히스토리 엔트리를 전부 되돌린 뒤 standalone 페이지로
    // 새로 이동한다. reload 방식은 스크롤 위치가 복원되고 모달 히스토리가
    // 남아서 뒤로가기가 꼬이는 문제가 있었다.
    expandBtn.addEventListener("click", function () {
      // ?company=1 같은 쿼리는 유지한 채 standalone 페이지로 이동
      pendingExpandUrl = location.pathname + location.search;
      if (depth > 0) {
        history.go(-depth);
      } else {
        window.location.assign(pendingExpandUrl);
      }
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) requestClose();
  });

  window.addEventListener("popstate", function (e) {
    if (pendingExpandUrl) {
      // 펼치기로 모달 히스토리를 되돌린 직후: 모달을 띄운 채로
      // standalone 페이지로 이동해 화면 깜빡임 없이 전환한다.
      var expandUrl = pendingExpandUrl;
      pendingExpandUrl = null;
      window.location.assign(expandUrl);
      return;
    }
    var st = e.state;
    if (st && st.projectModal) {
      depth = st.idx || 1;
      if (modal.hidden) {
        // 앞으로가기 등으로 모달 상태에 재진입한 경우 내용을 다시 불러온다.
        loadProject(location.pathname, function () {
          panel.scrollTop = st.scrollTop || 0;
        });
      } else {
        panel.scrollTop = st.scrollTop || 0;
      }
      return;
    }
    hideModal();
  });
})();
