(function () {
  var query = new URLSearchParams(window.location.search);
  if (query.get("company") !== "1") return;

  // 회사 프로젝트 섹션 표시 (홈에만 존재)
  document.querySelectorAll("[data-company-projects]").forEach(function (section) {
    section.hidden = false;
  });

  // 사이트 내부 링크 클릭 시 쿼리를 이어붙여 이동 후에도 상태가 유지되게 한다.
  // 저장소 없이 URL로만 전파하므로 쿼리 없이 접속하면 항상 기본 상태다.
  document.addEventListener(
    "click",
    function (e) {
      var link = e.target.closest("a[href]");
      if (!link) return;
      if (link.origin !== location.origin) return;
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) === "#") return;
      var qs = new URLSearchParams(link.search);
      if (qs.get("company") === "1") return;
      qs.set("company", "1");
      link.search = qs.toString();
    },
    true // capture: 모달 등 다른 클릭 핸들러가 href를 읽기 전에 실행
  );
})();
